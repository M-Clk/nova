import { useQuery } from "@tanstack/react-query";
import { Stack, Typography } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { ReferenceDataDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function WarehousesPage() {
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Warehouses</Typography>
      <DataTable columns={["Name"]} rows={(references.data?.warehouses ?? []).map((w) => [w.name])} />
    </Stack>
  );
}
