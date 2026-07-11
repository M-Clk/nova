using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemLogsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS system_logs (
                    id uuid NOT NULL DEFAULT (gen_random_uuid()),
                    message text,
                    message_template text,
                    level character varying(128),
                    timestamp timestamp with time zone NOT NULL,
                    exception text,
                    properties text,
                    CONSTRAINT ""PK_system_logs"" PRIMARY KEY (id)
                );
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_system_logs_level"" ON system_logs (level);
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_system_logs_timestamp"" ON system_logs (timestamp);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS system_logs;");
        }
    }
}
