function isRecoverablePanic(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "PrismaClientRustPanicError" ||
    message.includes("timer has gone away") ||
    message.includes("query engine has panicked")
  );
}

function isCallable(value) {
  return typeof value === "function";
}

export function createRetryablePrismaClientProxy({ createClient, disconnectClient }) {
  if (typeof createClient !== "function") {
    throw new TypeError("createClient must be a function.");
  }

  const disconnect = typeof disconnectClient === "function"
    ? disconnectClient
    : async (client) => client?.$disconnect?.();

  let currentClient = createClient();
  let refreshPromise = null;

  async function replaceClient() {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const previousClient = currentClient;
        currentClient = createClient();

        try {
          await disconnect(previousClient);
        } catch (error) {
          console.warn("Failed to disconnect stale Prisma client:", error?.message || error);
        } finally {
          refreshPromise = null;
        }
      })();
    }

    return refreshPromise;
  }

  function resolvePath(path) {
    let target = currentClient;
    for (let index = 0; index < path.length - 1; index += 1) {
      target = target?.[path[index]];
    }

    const key = path[path.length - 1];
    const value = target?.[key];
    return { target, key, value };
  }

  async function invokePath(path, args, allowRetry = true) {
    if (path.length === 0) {
      throw new Error("Cannot invoke the Prisma proxy directly.");
    }

    const { target, key, value } = resolvePath(path);
    if (!isCallable(value)) {
      return value;
    }

    try {
      return await value.apply(target, args);
    } catch (error) {
      if (allowRetry && isRecoverablePanic(error)) {
        await replaceClient();
        return invokePath(path, args, false);
      }

      throw error;
    }
  }

  function createProxy(path = []) {
    const callable = function prismaProxyCallable() {};

    return new Proxy(callable, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        if (prop === Symbol.toPrimitive) return undefined;
        return createProxy([...path, prop]);
      },
      apply(_target, _thisArg, args) {
        return invokePath(path, args);
      }
    });
  }

  return {
    prisma: createProxy(),
    async close() {
      try {
        await disconnect(currentClient);
      } catch (error) {
        console.warn("Failed to disconnect Prisma client:", error?.message || error);
      }
    },
    async reconnect() {
      await replaceClient();
    }
  };
}

export { isRecoverablePanic as isRecoverablePrismaPanicError };

