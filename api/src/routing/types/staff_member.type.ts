export interface StaffMember {
  staff_id: string;
  name: string;
  role: string;
  skills: string[];
  status: string;
  max_concurrent_supervision: number;
  // Live supervised calls plus ESCALATED cases assigned to them.
  current_load: number;
}
