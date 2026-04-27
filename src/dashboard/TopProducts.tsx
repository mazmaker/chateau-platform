import { Progress } from "@/components/ui/progress";

interface Product {
  id: string;
  name: string;
  popularity: number;
  sales: string;
}

const products: Product[] = [
  { id: "1", name: "Riverside Condo", popularity: 85, sales: "45%" },
  { id: "2", name: "Urban Loft", popularity: 72, sales: "32%" },
  { id: "3", name: "Garden Villa", popularity: 65, sales: "28%" },
  { id: "4", name: "Sky Tower", popularity: 58, sales: "22%" },
];

export const TopProducts = () => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Top Products</h3>
        <p className="text-sm text-muted-foreground">Best selling properties</p>
      </div>
      <div className="space-y-4">
        {products.map((product, index) => (
          <div 
            key={product.id} 
            className="flex items-center gap-4 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground truncate">{product.name}</p>
                <span className="text-sm text-muted-foreground ml-2">{product.sales}</span>
              </div>
              <Progress value={product.popularity} className="h-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
