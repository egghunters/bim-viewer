import { get } from "./base";

export async function getJson(url: string) {
  const res = await get(url);
  return res.data;
}
