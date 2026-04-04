export default async () => {
  return Response.json({ status: "ok" });
};

export const config = {
  path: "/api/health",
  method: "GET",
};
