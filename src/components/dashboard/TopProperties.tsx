import { Star, MapPin, TrendingUp } from 'lucide-react';

const propertiesData = [
  {
    id: 1,
    name: 'Seaside Villa A',
    location: 'Phuket, Thailand',
    rating: 4.8,
    reviews: 124,
    occupancy: 92,
    revenue: 485000,
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=64&h=64&fit=crop&crop=center'
  },
  {
    id: 2,
    name: 'Mountain View B',
    location: 'Chiang Mai, Thailand',
    rating: 4.9,
    reviews: 89,
    occupancy: 88,
    revenue: 412000,
    image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=64&h=64&fit=crop&crop=center'
  },
  {
    id: 3,
    name: 'Beach Resort D',
    location: 'Krabi, Thailand',
    rating: 4.7,
    reviews: 203,
    occupancy: 95,
    revenue: 628000,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=64&h=64&fit=crop&crop=center'
  }
];

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-medium text-gray-900">{rating}</span>
      </div>
  );
};

const TopProperties = () => {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">Top Properties</h3>
        <button className="text-sm text-chateau hover:text-chateau-700 font-medium">
          View all
        </button>
      </div>
      <div className="space-y-4">
        {propertiesData.map((property, index) => (
          <div key={property.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="relative">
              <img
                src={property.image}
                alt={property.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="absolute -top-1 -left-1 w-4 h-4 bg-chateau text-white text-xs font-bold rounded-full flex items-center justify-center">
                {index + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {property.name}
              </h4>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{property.location}</span>
              </div>
            </div>
            <div className="text-right">
              <StarRating rating={property.rating} />
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-xs text-gray-600">{property.occupancy}% occupied</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                ฿{property.revenue.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopProperties;