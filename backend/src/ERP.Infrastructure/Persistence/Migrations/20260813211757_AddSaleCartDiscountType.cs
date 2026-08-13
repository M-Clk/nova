using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ERP.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleCartDiscountType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CartDiscountPercentage",
                table: "Sales",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CartDiscountType",
                table: "Sales",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CartDiscountPercentage",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "CartDiscountType",
                table: "Sales");
        }
    }
}
