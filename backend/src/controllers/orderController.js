import { createOrder, deleteOrder, listOrders, moveOrderToProduction, updateOrder, updateOrderPayment } from "../services/orderService.js";
import { emptyPaginatedOrArrayFallback, isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";
import { assertEnquiryAccess, assertOrderAccess, scopedOwnerId } from "../utils/dataScope.js";

export async function getOrders(req, res, next) {
  try {
    const orders = await listOrders(req.query, { ownerId: scopedOwnerId(req.user) });
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.json(orders);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json(emptyPaginatedOrArrayFallback(req));
    }
    return next(error);
  }
}

export async function addOrder(req, res, next) {
  try {
    // An order raised from an enquiry counts as the enquiry owner's, so a user
    // limited to their own data may only raise one from their own enquiry.
    if (req.validatedBody.enquiry_id) {
      await assertEnquiryAccess(req.user, Number(req.validatedBody.enquiry_id));
    }
    const order = await createOrder(req.validatedBody, req.user);
    return res.status(201).json(order);
  } catch (error) {
    return next(error);
  }
}

export async function editOrder(req, res, next) {
  try {
    await assertOrderAccess(req.user, toPositiveIntOrThrow(req.params.id, "id"));
    const order = await updateOrder(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function removeOrder(req, res, next) {
  try {
    await assertOrderAccess(req.user, toPositiveIntOrThrow(req.params.id, "id"));
    const order = await deleteOrder(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    await assertOrderAccess(req.user, toPositiveIntOrThrow(req.params.id, "id"));
    const order = await moveOrderToProduction(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function recordOrderPayment(req, res, next) {
  try {
    await assertOrderAccess(req.user, toPositiveIntOrThrow(req.params.id, "id"));
    const order = await updateOrderPayment(
      toPositiveIntOrThrow(req.params.id, "id"),
      req.validatedBody,
      req.user
    );
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}
