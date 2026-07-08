import { apiClient } from "./apiClient";
import { PaginatedLogsDto } from "./types";

export type GetLogsParams = {
  page?: number;
  pageSize?: number;
  level?: string;
  search?: string;
};

export const getLogs = async (params: GetLogsParams): Promise<PaginatedLogsDto> => {
  const { data } = await apiClient.get<PaginatedLogsDto>("/logs", { params });
  return data;
};

export const triggerTestLog = async (level: string, message: string): Promise<{ message: string }> => {
  const { data } = await apiClient.post<{ message: string }>("/logs/test", null, {
    params: { level, message }
  });
  return data;
};
