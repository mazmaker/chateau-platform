import { format } from 'date-fns';

const bookingsData = [
  {
    id: 'BKG-2024-001',
    guestName: 'John Doe',
    property: 'Seaside Villa A',
    checkIn: '2024-03-21',
    checkOut: '2024-03-25',
    status: 'Checked-in',
    amount: 12000
  },
  {
    id: 'BKG-2024-002',
    guestName: 'Jane Smith',
    property: 'Mountain View B',
    checkIn: '2024-03-22',
    checkOut: '2024-03-24',
    status: 'Confirmed',
    amount: 8000
  },
  {
    id: 'BKG-2024-003',
    guestName: 'Robert Johnson',
    property: 'City Center C',
    checkIn: '2024-03-23',
    checkOut: '2024-03-26',
    status: 'Pending',
    amount: 15000
  },
  {
    id: 'BKG-2024-004',
    guestName: 'Mary Williams',
    property: 'Beach Resort D',
    checkIn: '2024-03-24',
    checkOut: '2024-03-28',
    status: 'Confirmed',
    amount: 20000
  },
  {
    id: 'BKG-2024-005',
    guestName: 'David Brown',
    property: 'Forest Lodge E',
    checkIn: '2024-03-25',
    checkOut: '2024-03-27',
    status: 'Checked-in',
    amount: 10000
  }
];

const getStatusBadge = (status: string) => {
  const styles = {
    'Checked-in': 'bg-green-100 text-green-800',
    'Confirmed': 'bg-blue-100 text-blue-800',
    'Pending': 'bg-yellow-100 text-yellow-800',
    'Cancelled': 'bg-red-100 text-red-800'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles['Pending']}`}>
      {status}
    </span>
  );
};

const BookingsTable = () => {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">Recent Bookings</h3>
        <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          View all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Guest Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Check-in
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Check-out
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookingsData.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {booking.id}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {booking.guestName}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {booking.property}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(booking.checkIn), 'MMM dd, yyyy')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(booking.checkOut), 'MMM dd, yyyy')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(booking.status)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ฿{booking.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BookingsTable;