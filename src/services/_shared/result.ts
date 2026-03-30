export type ServiceResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: string };
