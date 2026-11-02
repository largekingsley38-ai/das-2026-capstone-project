// Settings that can change between machines. Read once, here.
export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  publicDir: new URL('../public/', import.meta.url),
};