export const getUser = (req) => {
  const authorization = req.headers['authorization'];
  const token = authorization.split(' ')[1];
  const data = Object.fromEntries(new URLSearchParams(token));
  const user = JSON.parse(data.user || {});
  return user;
};
