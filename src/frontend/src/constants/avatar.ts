/**
 * Ready Player Me configuration.
 * TODO: Promote these constants to environment variables or a config module when the
 * deployment story expands beyond the course project.
 */
export const READY_PLAYER_ME_URL =
  "https://demo.readyplayer.me/avatar?frameApi";

export const STUDENT_AVATAR_UPDATED_EVENT = "student-avatar-updated";

export function toAvatarImageUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const isReadyPlayerModel =
      url.hostname.includes("readyplayer.me") && url.pathname.endsWith(".glb");

    if (isReadyPlayerModel) {
      url.pathname = url.pathname.replace(/\.glb$/, ".png");
      // Optionally request a portrait scene if supported by the account.
      if (!url.searchParams.has("scene")) {
        url.searchParams.set("scene", "fullbody-portrait-v1");
      }
      return url.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}
