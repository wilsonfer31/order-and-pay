import { HttpInterceptorFn } from '@angular/common/http';

export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('http')) {
    req = req.clone({ url: `/api${req.url}` });
  }
  return next(req);
};
