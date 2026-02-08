export interface UserProfile {
  latex: string;
  lastModified: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  latex: '',
  lastModified: new Date().toISOString(),
};
