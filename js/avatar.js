// js/avatar.js
// Supabase 스토리지 설정 (프로필 사진 버킷)
export const SUPABASE_URL = "https://xnbegbwpqhhfbnhwjbuw.supabase.co";
export const AVATAR_BUCKET = "avatars";

/** 업로드 경로: avatars/{uid}/avatar  (스토리지 정책이 폴더명 = Firebase uid 로 검사) */
export const avatarPath = (uid) => `${uid}/avatar`;

/** 업로드 전에 정사각형으로 자르고 줄여서 용량(=스토리지/전송 비용)을 줄인다 */
export async function resizeImage(file, size = 400) {
  const img = await loadImage(file);
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2;
  const sy = (img.height - s) / 2;
  const out = Math.min(size, s);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);

  const blob =
    (await toBlob(canvas, "image/webp", 0.86)) ||
    (await toBlob(canvas, "image/jpeg", 0.88));
  if (!blob) throw new Error("이미지를 변환하지 못했어요.");
  return blob;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없어요.")); };
    img.src = url;
  });
}

function toBlob(canvas, type, q) {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b && b.type === type ? b : null), type, q)
  );
}
