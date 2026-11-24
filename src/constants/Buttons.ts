// The site-wide call-to-action buttons (globals.css), in the sizes the feedback pages use.
const BASE = 'chamfer header__button';

export const BUTTON = {
  main: `${BASE} header__button--main`,
  secondary: `${BASE} header__button--secondary`,
  action: `${BASE} header__button--secondary header__button--compact`,
  mainAction: `${BASE} header__button--main header__button--compact`,
  danger: `${BASE} header__button--secondary header__button--compact feedback-button--danger`,
};
