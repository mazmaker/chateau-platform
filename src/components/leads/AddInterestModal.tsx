import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import {
  InterestStatus,
  InterestLevel,
  INTEREST_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
} from "@/types/lead-interest";

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
  floor?: number;
  bedrooms?: number;
  price?: number;
  status?: string;
}

interface AddInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInterestAdded: () => void;
  leadId: string;
  existingUnitIds?: string[];
}

const AddInterestModal = ({
  isOpen,
  onClose,
  onInterestAdded,
  leadId,
  existingUnitIds = [],
}: AddInterestModalProps) => {
  const { currentTenant } = useSimpleAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    property_id: "",
    unit_id: "",
    status: "interested" as InterestStatus,
    interest_level: "medium" as InterestLevel,
    notes: "",
    viewing_date: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchProperties();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.property_id) {
      fetchUnits(formData.property_id);
    } else {
      setUnits([]);
    }
  }, [formData.property_id]);

  const resetForm = () => {
    setFormData({
      property_id: "",
      unit_id: "",
      status: "interested",
      interest_level: "medium",
      notes: "",
      viewing_date: "",
    });
    setError("");
  };

  const fetchProperties = async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, type")
      .eq("tenant_id", currentTenant?.id)
      .order("name");
    setProperties(data || []);
  };

  const fetchUnits = async (propertyId: string) => {
    const { data } = await supabase
      .from("units")
      .select("id, unit_number, project_id, floor, bedrooms, price, status")
      .eq("project_id", propertyId)
      .order("unit_number");

    // Filter out already added units
    const availableUnits = (data || []).filter(
      (unit) => !existingUnitIds.includes(unit.id)
    );
    setUnits(availableUnits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.property_id || !formData.unit_id) {
      setError("กรุณาเลือกโครงการและยูนิต");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("lead_interests")
        .insert({
          tenant_id: currentTenant?.id,
          lead_id: leadId,
          property_id: formData.property_id,
          unit_id: formData.unit_id,
          status: formData.status,
          interest_level: formData.interest_level,
          notes: formData.notes || null,
          viewing_date: formData.viewing_date || null,
        });

      if (insertError) throw insertError;

      onInterestAdded();
      onClose();
    } catch (err: any) {
      console.error("Error adding interest:", err);
      if (err.code === "23505") {
        setError("ยูนิตนี้ถูกเพิ่มไปแล้ว");
      } else {
        setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return "";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            เพิ่มยูนิตที่สนใจ
          </DialogTitle>
          <DialogDescription>
            เลือกโครงการและยูนิตที่ Lead สนใจ
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property Selection */}
          <div className="space-y-2">
            <Label>โครงการ *</Label>
            <Select
              value={formData.property_id}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  property_id: value,
                  unit_id: "",
                }))
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกโครงการ" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Selection */}
          <div className="space-y-2">
            <Label>ยูนิต *</Label>
            <Select
              value={formData.unit_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, unit_id: value }))
              }
              disabled={loading || !formData.property_id}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    formData.property_id ? "เลือกยูนิต" : "เลือกโครงการก่อน"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {units.length === 0 && formData.property_id ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    ไม่มียูนิตที่พร้อมเพิ่ม
                  </div>
                ) : (
                  units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{unit.unit_number}</span>
                        {unit.price && (
                          <span className="text-muted-foreground ml-2">
                            {formatPrice(unit.price)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Status & Interest Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select
                value={formData.status}
                onValueChange={(value: InterestStatus) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span>
                        {option.icon} {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ระดับความสนใจ</Label>
              <Select
                value={formData.interest_level}
                onValueChange={(value: InterestLevel) =>
                  setFormData((prev) => ({ ...prev, interest_level: value }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span>
                        {option.icon} {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Viewing Date */}
          {(formData.status === "viewing_scheduled" ||
            formData.status === "viewed") && (
            <div className="space-y-2">
              <Label>วันที่นัดดู / ดูแล้ว</Label>
              <Input
                type="datetime-local"
                value={formData.viewing_date}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    viewing_date: e.target.value,
                  }))
                }
                disabled={loading}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>บันทึก</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="บันทึกเพิ่มเติม..."
              disabled={loading}
              rows={2}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "เพิ่มยูนิต"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddInterestModal;
