import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const salesData = [
  {
    id: 1,
    name: "สมชาย ศรีสวัสดิ์",
    project: "BAAN ISSARA",
    unit: "241/33",
    house: "28,422,392",
    discount: "26,900,250",
    note: "",
    date: "08-03-24",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1"
  },
  {
    id: 2,
    name: "สมชาย ศรีสวัสดิ์",
    project: "BAAN ISSARA",
    unit: "97/33",
    house: "27,300,500",
    discount: "24,800,000",
    note: "",
    date: "06-03-24",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2"
  },
  {
    id: 3,
    name: "สมชาย ศรีสวัสดิ์",
    project: "BAAN ISSARA",
    unit: "213/7",
    house: "26,956,324",
    discount: "20,001,900",
    note: "",
    date: "04-02-24",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3"
  },
  {
    id: 4,
    name: "สมชาย ศรีสวัสดิ์",
    project: "BAAN ISSARA",
    unit: "28/7",
    house: "19,800,500",
    discount: "17,990,000",
    note: "",
    date: "29-01-24",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=4"
  },
  {
    id: 5,
    name: "สมชาย ศรีสวัสดิ์",
    project: "BAAN ISSARA",
    unit: "213/7",
    house: "15,900,250",
    discount: "9,800,050",
    note: "",
    date: "28-01-24",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=5"
  },
];

export const SalesDataTable = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow mb-4">
      <div className="flex items-center gap-4 mb-4">
        <span className="text-2xl font-bold text-primary">18</span>
        <span className="text-sm text-muted-foreground">รายการการขาย</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">ลูป</TableHead>
              <TableHead className="text-xs">ชื่อ-นามสกุล</TableHead>
              <TableHead className="text-xs">แบบบ้าน</TableHead>
              <TableHead className="text-xs">เลขที่บ้าน</TableHead>
              <TableHead className="text-xs">ยอดบ้าน (฿)</TableHead>
              <TableHead className="text-xs">ยอดโอน (฿)</TableHead>
              <TableHead className="text-xs">หมายเหตุ</TableHead>
              <TableHead className="text-xs">วันที่ขาย</TableHead>
              <TableHead className="text-xs">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesData.map((row) => (
              <TableRow key={row.id} className="hover:bg-secondary/50">
                <TableCell>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={row.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {row.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="text-xs font-medium">{row.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.project}</TableCell>
                <TableCell className="text-xs">{row.unit}</TableCell>
                <TableCell className="text-xs text-primary font-medium">{row.house}</TableCell>
                <TableCell className="text-xs text-success font-medium">{row.discount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.note || "-"}</TableCell>
                <TableCell className="text-xs">{row.date}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Edit className="w-3 h-3 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
