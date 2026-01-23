import { Validator } from '../validator';

export function useValidator() {
  const createValidator = (el = document.body) => {
    return new Validator(el);
  };

  return {
    createValidator,
  };
}
