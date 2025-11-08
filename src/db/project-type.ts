export enum ProjectType {
  OFFICE_1 = 'office_1',
  OFFICE_2 = 'office_2',
}

export interface AdminPermissions {
  canAddCars?: boolean;
  canViewCars?: boolean;
  canManageLeads?: boolean; // включает редактирование своих лидов
  canViewLeads?: boolean; // только просмотр своих лидов, без редактирования
  isLeadManager?: boolean; // видит ВСЕХ лидов и ВСЕ задачи (как супер-админ для лидов)
}

