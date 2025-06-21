"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Calendar as CalendarIcon } from "lucide-react"
import { format, subMonths, addYears } from "date-fns"
import { DateRange } from "react-day-picker"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

// --- API 응답 및 데이터 타입 정의 ---
export type Forecast = {
  predictedDate: string;
  predictedQuantity: number;
};

export type ActualSales = {
  date: string;
  quantity: number;
};

export type Company = {
  customerId: number | string;
  companyName: string | null;
  companySize: string | null;
};

// --- 차트 설정 ---
const chartConfig = {
  predictedQuantity: { 
    label: "예측 수량 (월별)", 
    color: "hsl(var(--primary))" 
  },
  actualSalesMonthly: { 
    label: "실제 수량 (월별)", 
    color: "hsl(var(--chart-2))" 
  },
}

// --- 메인 차트 컴포넌트 ---
export function ForecastChart({
  allCompanies,
  selectedCompanyId,
  onCompanyChange,
  forecastData,
  actualSalesData
}: {
  allCompanies: Company[];
  selectedCompanyId: string | null;
  onCompanyChange: (id: string) => void;
  forecastData: Forecast[];
  actualSalesData: ActualSales[];
}) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [period, setPeriod] = React.useState<string>("12months");

  // 일별 실제 매출 데이터를 월별로 집계
  const monthlyActualSales = React.useMemo(() => {
    if (!actualSalesData || !Array.isArray(actualSalesData)) return [];

    const monthlyMap = new Map<string, number>();
    actualSalesData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      const currentSum = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, currentSum + (item.quantity || 0));
    });

    return Array.from(monthlyMap.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [actualSalesData]);

  // 예측 데이터와 월별 실제 매출 데이터를 결합
  const combinedChartData = React.useMemo(() => {
    const dataMap = new Map<string, { predictedQuantity?: number; actualSalesMonthly?: number }>();

    (forecastData || []).forEach(item => {
      const dateKey = item.predictedDate.split('T')[0];
      dataMap.set(dateKey, { ...dataMap.get(dateKey), predictedQuantity: item.predictedQuantity });
    });

    monthlyActualSales.forEach(item => {
      dataMap.set(item.date, { ...dataMap.get(item.date), actualSalesMonthly: item.quantity });
    });

    return Array.from(dataMap.entries())
      .map(([date, values]) => ({
        date,
        predictedQuantity: values.predictedQuantity || 0,
        actualSalesMonthly: values.actualSalesMonthly || 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [forecastData, monthlyActualSales]);

  // 선택된 날짜 범위에 따라 차트 데이터 필터링
  const filteredChartData = React.useMemo(() => {
    if (!dateRange?.from) return combinedChartData;

    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to ? dateRange.to.getTime() : Infinity;

    return combinedChartData.filter(d => {
      const date = new Date(d.date).getTime();
      return date >= fromTime && date <= toTime;
    });
  }, [combinedChartData, dateRange]);

  // '기간 선택' 드롭다운 핸들러
  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const today = new Date();
    let from: Date | undefined;
    let to: Date | undefined = addYears(today, 5);

    switch (value) {
      case "6months":
        from = subMonths(today, 6);
        break;
      case "12months":
        from = subMonths(today, 12);
        break;
      case "24months":
        from = subMonths(today, 24);
        break;
      case "all":
      default:
        from = undefined;
        to = undefined;
        break;
    }
    setDateRange({ from, to });
  };
  
  // 컴포넌트 마운트 시 기본 기간 설정
  React.useEffect(() => {
    handlePeriodChange("12months");
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-xl md:text-2xl">주문량 예측 추이 (월별 비교)</CardTitle>
          <CardDescription className="text-sm md:text-base mt-2">
            선택된 회사의 월별 주문 예측 및 실제 수량 추이입니다.
          </CardDescription>
        </div>
        
        {/* 반응형 컨트롤 섹션 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap">
          {/* 기간 선택 */}
          <div className="w-full sm:w-auto">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                <SelectItem value="6months">최근 6개월</SelectItem>
                <SelectItem value="12months">최근 12개월</SelectItem>
                <SelectItem value="24months">최근 24개월</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 날짜 범위 선택 */}
          <div className="w-full sm:w-auto">
            <DateRangePicker 
              date={dateRange} 
              onDateChange={setDateRange}
              className="w-full sm:w-auto"
            />
          </div>

          {/* 회사 선택 */}
          <div className="w-full sm:w-auto lg:ml-auto">
            <CompanySearchCombobox
              companies={allCompanies}
              value={selectedCompanyId}
              onSelect={onCompanyChange}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6">
        <div className="h-[300px] md:h-[400px] lg:h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="fillPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => format(new Date(value), "yy-MM")}
                interval="preserveStartEnd"
              />
              
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium text-sm">
                        {format(new Date(label), "yyyy년 MM월")}
                      </p>
                      {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div 
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.name}: </span>
                          <span className="font-medium">
                            {Number(entry.value).toLocaleString()} 개
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              
              <Area
                type="monotone"
                dataKey="predictedQuantity"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="url(#fillPredicted)"
                strokeWidth={2}
                name="예측 수량 (월별)"
              />
              
              <Area
                type="monotone"
                dataKey="actualSalesMonthly"
                stackId="2"
                stroke="hsl(var(--chart-2))"
                fill="url(#fillActual)"
                strokeWidth={2}
                name="실제 수량 (월별)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// --- 하위 컴포넌트들 ---

function CompanySearchCombobox({
  companies,
  value,
  onSelect,
}: {
  companies: Company[];
  value: string | null;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false)
  const selectedCompany = companies.find(c => String(c.customerId) === value)

  const getDisplayValue = (company: Company | undefined) => {
    if (!company) return "회사를 선택하세요...";
    const name = company.companyName || `Customer ${company.customerId}`;
    return company.companySize ? `${name} (${company.companySize})` : name;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open}
          className="w-full sm:w-[280px] justify-between"
        >
          <span className="truncate text-left">
            {getDisplayValue(selectedCompany)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="회사명 또는 규모로 검색..." className="h-9" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {companies.map((company) => (
                <CommandItem
                  key={company.customerId}
                  value={`${company.companyName || ''} ${company.companySize || ''}`}
                  onSelect={() => {
                    onSelect(String(company.customerId))
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <Check 
                    className={cn(
                      "mr-2 h-4 w-4", 
                      value === String(company.customerId) ? "opacity-100" : "opacity-0"
                    )} 
                  />
                  <span className="truncate">{getDisplayValue(company)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function DateRangePicker({
  date,
  onDateChange,
  className,
}: {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date?.from ? (
              date.to ? (
                <>
                  <span className="hidden sm:inline">
                    {format(date.from, "yyyy/MM/dd")} - {format(date.to, "yyyy/MM/dd")}
                  </span>
                  <span className="sm:hidden">
                    {format(date.from, "MM/dd")} - {format(date.to, "MM/dd")}
                  </span>
                </>
              ) : (
                format(date.from, "yyyy/MM/dd")
              )
            ) : (
              <span>날짜 범위 선택</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={onDateChange}
          numberOfMonths={2}
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  );
}
