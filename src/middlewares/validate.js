/**
 * Valida body/params/query con esquemas zod.
 * Los datos ya validados quedan en req.valid.{body,params,query}.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const key of ['params', 'query', 'body']) {
    if (schemas[key]) req.valid[key] = schemas[key].parse(req[key] ?? {});
  }
  next();
};
