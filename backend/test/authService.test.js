import test from "node:test";
import assert from "node:assert/strict";
import { loginUser } from "../src/services/authService.js";

test("loginUser accepts bcrypt-backed credentials", async () => {
  const prismaCalls = [];
  const fakePrisma = {
    user: {
      async findUnique() {
        return {
          id: 1,
          name: "Admin User",
          email: "admin@gmail.com",
          role: "admin",
          password: "$2a$10$ODp/BD8xh3z8GzyXh28E.uwHqqmiHhYzo6JdpWTcDDirO3LnApPO2"
        };
      },
      async update(args) {
        prismaCalls.push(args);
        return null;
      }
    }
  };

  const result = await loginUser("admin@gmail.com", "123456", {
    prismaClient: fakePrisma,
    bcryptLib: {
      async compare() {
        return true;
      },
      async hash() {
        throw new Error("hash should not be called for bcrypt users");
      }
    }
  });

  assert.equal(result.user.email, "admin@gmail.com");
  assert.equal(prismaCalls.length, 0);
  assert.equal(typeof result.token, "string");
});

test("loginUser tolerates legacy plain-text credentials and upgrades them", async () => {
  const prismaCalls = [];
  const fakePrisma = {
    user: {
      async findUnique() {
        return {
          id: 2,
          name: "Legacy User",
          email: "legacy@example.com",
          role: "sales",
          password: "legacy123"
        };
      },
      async update(args) {
        prismaCalls.push(args);
        return null;
      }
    }
  };

  const result = await loginUser("legacy@example.com", "legacy123", {
    prismaClient: fakePrisma,
    bcryptLib: {
      async compare() {
        throw new Error("compare should not be called for plain-text legacy users");
      },
      async hash(password) {
        return `hashed:${password}`;
      }
    }
  });

  assert.equal(result.user.email, "legacy@example.com");
  assert.equal(prismaCalls.length, 1);
  assert.deepEqual(prismaCalls[0], {
    where: { id: 2 },
    data: { password: "hashed:legacy123" }
  });
});

test("loginUser rejects invalid credentials", async () => {
  const fakePrisma = {
    user: {
      async findUnique() {
        return {
          id: 3,
          name: "Admin User",
          email: "admin@gmail.com",
          role: "admin",
          password: "$2a$10$ODp/BD8xh3z8GzyXh28E.uwHqqmiHhYzo6JdpWTcDDirO3LnApPO2"
        };
      }
    }
  };

  await assert.rejects(
    () => loginUser("admin@gmail.com", "wrong-password", {
      prismaClient: fakePrisma,
      bcryptLib: {
        async compare() {
          return false;
        }
      }
    }),
    (error) => error.statusCode === 401 && error.message === "Invalid email or password."
  );
});
