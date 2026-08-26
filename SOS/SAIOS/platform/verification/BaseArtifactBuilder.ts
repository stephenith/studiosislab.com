/**
 * BaseArtifactBuilder — Agent #173.
 * Generic builder result shape. No domain fields.
 */
export type ArtifactBuildResult<T> = {
  ok: boolean;
  artifact: T | null;
  error?: string;
  error_code?: string;
  artifact_paths?: string[];
};

export class BaseArtifactBuilder {
  ok<T>(artifact: T, paths: string[] = []): ArtifactBuildResult<T> {
    return { ok: true, artifact, artifact_paths: paths };
  }

  fail<T = never>(
    error: string,
    error_code: string,
  ): ArtifactBuildResult<T> {
    return {
      ok: false,
      artifact: null,
      error,
      error_code,
      artifact_paths: [],
    };
  }
}
