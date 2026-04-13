import { createUser, deleteUser, listUsers, updateUser } from "../services/userService.js";

export async function getUsers(req, res, next) {
  try {
    const users = await listUsers(req.query);
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

export async function addUser(req, res, next) {
  try {
    const user = await createUser(req.validatedBody);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

export async function editUser(req, res, next) {
  try {
    const user = await updateUser(Number(req.params.id), req.validatedBody);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

export async function removeUser(req, res, next) {
  try {
    await deleteUser(Number(req.params.id));
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
