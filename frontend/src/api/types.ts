// ─── User / Auth Types ──────────────────────────────────────────────────────

export type UserDto = {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type CreateUserRequest = {
  username: string;
  email: string;
  password: string;
  role: string;
};

export type UpdateUserRequest = {
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  newPassword?: string;
};

export type LookupDto = {
  id: string;
  code: string;
  name: string;
};

export type ReferenceDataDto = {
  brands: LookupDto[];
  categories: LookupDto[];
  units: LookupDto[];
  warehouses: LookupDto[];
};

export type CreateLookupRequest = {
  name: string;
  code?: string;
  parentId?: string | null;
};

export type UpdateLookupRequest = {
  name: string;
  code?: string;
  parentId?: string | null;
};

export type ProductDto = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  isActive: boolean;
};

export type CustomerDto = {
  id: string;
  code: string;
  name: string;
  phone: string;
};

export type SaleDto = {
  id: string;
  saleNo: string;
  customerName?: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  createdAt: string;
};

export type StockMovementDto = {
  id: string;
  productCode: string;
  productName: string;
  warehouseName: string;
  type: number;
  quantity: number;
  unitPrice: number;
  referenceType: string;
  isCancelled: boolean;
  createdAt: string;
};

export type CurrentStockDto = {
  productCode: string;
  productName: string;
  warehouseName: string;
  quantity: number;
};

export type AddStockMovementRequest = {
  productId: string;
  warehouseId: string;
  type: number;
  quantity: number;
  unitPrice: number;
};


// ─── POS Types ───────────────────────────────────────────────────────────────

export type PosProductDto = {
  id: string;
  barcode: string;
  name: string;
  salePrice: number;
};

export type TerminalDto = {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  isActive: boolean;
};

export type CreateTerminalRequest = {
  code: string;
  name: string;
  warehouseId: string;
};

export type UpdateTerminalRequest = {
  code: string;
  name: string;
  warehouseId: string;
  isActive: boolean;
};

export type WarehouseDto = {
  id: string;
  name: string;
};

export type CreateWarehouseRequest = {
  name: string;
};

export type UpdateWarehouseRequest = {
  name: string;
};

export type CartItem = {
  productId: string;
  barcode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PosCheckoutItemRequest = {
  productId: string;
  quantity: number;
};

export type PosCheckoutRequest = {
  customerId: string | null;
  terminalId: string;
  items: PosCheckoutItemRequest[];
};

export type PosCheckoutResult = {
  saleId: string;
  saleNo: string;
  totalAmount: number;
  netAmount: number;
};

export interface PaginatedListDto<T> {
  items: T[];
  totalCount: number;
}

