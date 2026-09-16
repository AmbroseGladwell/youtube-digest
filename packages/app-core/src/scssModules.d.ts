declare module "*.module.scss" {
  const classNames: { readonly [className: string]: string };
  export default classNames;
}
