import { HttpInterceptorFn } from '@angular/common/http';

export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => {
  // Only prefix relative URLs (not http:// or https://)
  if (!req.url.startsWith('http')) {
    req = req.clone({ url: `/api${req.url}` });
  }
  return next(req);
};
