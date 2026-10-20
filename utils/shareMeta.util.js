const DESCRIPTION_MAX = 160;
const TITLE_MAX = 90;

export const GENERIC_SHARE = {
  title: "Motivata",
  description: "Open the Motivata app to see this.",
};

const squash = (text) =>
  String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const truncateText = (text, max) => {
  const clean = squash(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

export const firstNameOf = (name) => {
  const first = squash(name).split(" ")[0];
  return first || "";
};

export const isOpenClub = (club) => {
  if (!club) return false;
  const accessLevel = club.accessLevel || "OPEN";
  return accessLevel === "OPEN" && !club.requiresApproval;
};

export const isPublicProfile = (privacySettings) => {
  const p = privacySettings || {};
  const hidesEverything =
    p.showOccupation === false &&
    p.showAge === false &&
    p.showBio === false &&
    p.showPosts === false;
  return !hidesEverything;
};

export const isShareablePost = (post, club) => {
  if (!post) return false;
  if (post.isExplorePost === true) return true;
  if (post.club) return isOpenClub(club);
  return false;
};

export const isGenericPost = (post, club) => {
  if (!post) return false;
  if (post.isExplorePost === true) return false;
  return !!post.club && !isOpenClub(club);
};

export const buildPostShare = (post) => {
  const title = truncateText(post.title || post.caption || post.content, TITLE_MAX) || "Motivata post";
  const description =
    truncateText(post.subHeading || post.caption || post.content, DESCRIPTION_MAX) ||
    "See this post on Motivata.";
  const imageUrl =
    post.mediaType === "VIDEO"
      ? post.mediaThumbnail || null
      : (post.mediaUrls && post.mediaUrls[0]) || post.mediaThumbnail || null;
  return {
    type: "post",
    id: String(post._id),
    title,
    description,
    imageUrl,
    deepLink: `motivata://post/${post._id}`,
  };
};

export const buildGenericShare = (type, id) => ({
  type,
  id: String(id),
  title: GENERIC_SHARE.title,
  description: GENERIC_SHARE.description,
  imageUrl: null,
  deepLink: `motivata://${type}/${id}`,
});

export const buildEventShare = (event) => ({
  type: "event",
  id: String(event._id),
  title: truncateText(event.name, TITLE_MAX) || "Motivata event",
  description: truncateText(event.description, DESCRIPTION_MAX) || "Book your spot on Motivata.",
  imageUrl: (event.imageUrls && event.imageUrls[0]) || (event.thumbnail && event.thumbnail.imageUrl) || null,
  deepLink: `motivata://event/${event._id}`,
});

export const buildClubShare = (club) => ({
  type: "club",
  id: String(club._id),
  title: truncateText(club.name, TITLE_MAX) || "Motivata club",
  description: truncateText(club.description, DESCRIPTION_MAX) || "Join this club on Motivata.",
  imageUrl: club.thumbnail || null,
  deepLink: `motivata://club/${club._id}`,
});

export const buildUserShare = (user) => {
  const deepLink = `motivata://user/${user._id}`;
  if (!isPublicProfile(user.privacySettings)) {
    return {
      type: "user",
      id: String(user._id),
      title: "Motivata member",
      description: "Connect with this member on Motivata.",
      imageUrl: null,
      deepLink,
    };
  }
  const first = firstNameOf(user.name);
  return {
    type: "user",
    id: String(user._id),
    title: first ? `${first} on Motivata` : "Motivata member",
    description: first ? `Connect with ${first} on Motivata.` : "Connect with this member on Motivata.",
    imageUrl: user.photoUrl || null,
    deepLink,
  };
};
