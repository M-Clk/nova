import { useQuery } from "@tanstack/react-query";
import { Stack, Typography, Box } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { ReferenceDataDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function WarehousesPage() {
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>Depolar</Typography>
        <Typography color="text.secondary" variant="body2">
          Kayıtlı depoları ve depolama konumlarını görüntüleyin
        </Typography>
      </Box>
      <DataTable 
        columns={["Depo Adı", "Depo ID"]} 
        rows={(references.data?.warehouses ?? []).map((w) => [
          <Typography variant="body2" fontWeight={700} color="primary.main">{w.name}</Typography>,
          <Typography variant="body2" color="text.secondary">{w.id}</Typography>
        ])} 
      />
    </Stack>
  );
}
