export interface InviteRecord {
  inviter_id: string;
  total: number;
  active: number;
  left: number;
  fake: number;
}

export interface InviteLogEntry {
  id: number;
  inviter_id: string;
  invitee_id: string;
  invite_code: string;
  joined_at: string;
  left: boolean;
  is_fake: boolean;
}

export function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
