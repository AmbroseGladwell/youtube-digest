export const countFailed = async (writes: Promise<unknown>[]): Promise<number> => {
  return (await Promise.allSettled(writes)).filter((result) => result.status === "rejected").length;
};
