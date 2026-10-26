import type { Draft, Job, LogRow, ProfileInfo, Video } from "./store";

export type VideoRow = Video & { commented: boolean; has_draft: boolean };
export type { Draft, Job, LogRow, ProfileInfo };

export const JOB_LABEL: Record<Job["status"], string> = {
  queued: "대기 중",
  opening_profile: "프로필 여는 중",
  navigating: "영상으로 이동 중",
  finding_box: "댓글창 찾는 중",
  typing: "입력 중",
  posting: "게시 중",
  verifying: "내 댓글 확인 중",
  done: "게시 완료",
  failed: "실패",
};
