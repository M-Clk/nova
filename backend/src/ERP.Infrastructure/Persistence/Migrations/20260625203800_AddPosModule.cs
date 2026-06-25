using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPosModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TerminalId",
                table: "Sales",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Terminals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Terminals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Terminals_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Terminals",
                columns: new[] { "Id", "Code", "IsActive", "Name", "WarehouseId" },
                values: new object[,]
                {
                    { new Guid("55555555-5555-5555-5555-555555555551"), "KASA-1", true, "Kasa 1", new Guid("44444444-4444-4444-4444-444444444444") },
                    { new Guid("55555555-5555-5555-5555-555555555552"), "KASA-2", true, "Kasa 2", new Guid("44444444-4444-4444-4444-444444444444") },
                    { new Guid("55555555-5555-5555-5555-555555555553"), "KASA-3", true, "Kasa 3", new Guid("44444444-4444-4444-4444-444444444444") }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TerminalId",
                table: "Sales",
                column: "TerminalId");

            migrationBuilder.CreateIndex(
                name: "IX_Terminals_Code",
                table: "Terminals",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Terminals_WarehouseId",
                table: "Terminals",
                column: "WarehouseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_Terminals_TerminalId",
                table: "Sales",
                column: "TerminalId",
                principalTable: "Terminals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sales_Terminals_TerminalId",
                table: "Sales");

            migrationBuilder.DropTable(
                name: "Terminals");

            migrationBuilder.DropIndex(
                name: "IX_Sales_TerminalId",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "TerminalId",
                table: "Sales");
        }
    }
}
