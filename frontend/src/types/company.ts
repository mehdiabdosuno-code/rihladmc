export interface Company {
  id: string
  code: string
  name: string
  legal_name: string | null
  tax_id: string | null
  currency: string
  fiscal_year_start: number
  is_active: boolean
}

export interface CompanyWithRole extends Company {
  user_role: string
  is_default: boolean
}

export interface SwitchCompanyResponse {
  access_token: string
  refresh_token: string
  company: CompanyWithRole
}
