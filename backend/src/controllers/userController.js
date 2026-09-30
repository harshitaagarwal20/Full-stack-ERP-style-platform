import { changePassword, createUser, deleteUser, listUsers, updateUser } from "../services/userService.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

// Whose data a user may see is an admin decision, even when another role has
// been granted the users screen.
function assertCanSetDataScope(req) {
  if (req.validatedBody?.data_scope !== undefined && req.user?.role !== "admin") {
    const error = new Error("Only an admin can change a user's data access.");
    error.statusCode = 403;
    throw error;
  }
}

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
    assertCanSetDataScope(req);
    const user = await createUser(req.validatedBody);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

export async function editUser(req, res, next) {
  try {
    assertCanSetDataScope(req);
    const user = await updateUser(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

export async function removeUser(req, res, next) {
  try {
    await deleteUser(toPositiveIntOrThrow(req.params.id, "id"));
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function changeOwnPassword(req, res, next) {
  try {
    await changePassword(req.user.id, req.validatedBody.current_password, req.validatedBody.new_password);
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    return next(error);
  }
}
