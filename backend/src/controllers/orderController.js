import { createOrder, deleteOrder, listOrders, moveOrderToProduction, updateOrder } from "../services/orderService.js";

export async function getOrders(req, res, next) {
  try {
    const orders = await listOrders(req.query);
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.json(orders);
  } catch (error) {
    return next(error);
  }
}

export async function addOrder(req, res, next) {
  try {
    const order = await createOrder(req.validatedBody, req.user);
    return res.status(201).json(order);
  } catch (error) {
    return next(error);
  }
}

export async function editOrder(req, res, next) {
  try {
    const order = await updateOrder(Number(req.params.id), req.validatedBody, req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function removeOrder(req, res, next) {
  try {
    const order = await deleteOrder(Number(req.params.id), req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const order = await moveOrderToProduction(Number(req.params.id), req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}
