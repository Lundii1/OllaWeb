export interface UserProfile {
  latex: string;
  lastModified: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  latex: '',
  lastModified: new Date().toISOString(),
};

export interface ResumeVersion {
  id: string;
  title: string;
  latex: string;
  createdAt: number;
}
