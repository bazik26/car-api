export enum ProjectType {
  OFFICE_1 = 'office_1',
  OFFICE_2 = 'office_2',
}

export interface AdminPermissions {
  canAddCars: boolean;
  canViewCars: boolean;
  canManageLeads: boolean; // включает редактирование
  canViewLeads: boolean; // только просмотр, без редактирования
}

