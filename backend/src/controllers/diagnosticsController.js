import { testMysqlConnection } from "../services/mysqlHealthService.js";

export async function mysqlDiagnostics(req, res, next) {
  try {
    const result = await testMysqlConnection();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
