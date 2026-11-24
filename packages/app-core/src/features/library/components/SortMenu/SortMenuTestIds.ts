export const sortMenuTestIds = {
  trigger: "SortMenu.trigger",
  menu: "SortMenu.menu",
  dot: "SortMenu.dot",
  option: (group: "field" | "order" | "group", value: string) => `SortMenu.option.${group}.${value}`,
  reset: "SortMenu.reset",
  done: "SortMenu.done",
};
