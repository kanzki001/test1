"use client"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Edit,
  FileDown,
  GripVerticalIcon,
  MoreVerticalIcon,
  Trash2,
  Play,
  Download,
} from "lucide-react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

export const schema = z.object({
  cofId: z.number(),
  customerId: z.number(),
  companyName: z.string().nullable(),
  customerName: z.string().nullable(),
  predictedDate: z.string(),
  predictedQuantity: z.number(),
  mape: z.number().nullable(),
  predictionModel: z.string(),
  forecastGenerationDate: z.string(),
})

export type Forecast = z.infer<typeof schema>;

function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button 
      {...attributes} 
      {...listeners} 
      variant="ghost" 
      size="sm" 
      className="h-8 w-8 p-0 cursor-grab text-muted-foreground hover:bg-muted active:cursor-grabbing"
    >
      <GripVerticalIcon className="h-3 w-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function ForecastDetailSheet({
  isOpen,
  onOpenChange,
  item,
  onSave,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  item: Forecast | null
  onSave: (event: React.FormEvent<HTMLFormElement>, cofId: number) => void
}) {
  if (!item) return null;
  const sheetKey = item ? item.cofId : 'empty';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent key={sheetKey} side="right" className="flex flex-col w-full sm:w-[540px]">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-lg">예측 데이터 수정: {item.cofId}</SheetTitle>
          <SheetDescription className="text-sm">
            {item.companyName || item.customerName}의 예측 데이터를 수정합니다.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={(e) => onSave(e, item.cofId)} className="flex flex-1 flex-col justify-between">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="predictedDate" className="text-sm font-medium">예측 날짜</Label>
                <Input 
                  name="predictedDate" 
                  defaultValue={new Date(item.predictedDate).toISOString().split("T")[0]} 
                  type="date" 
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="predictedQuantity" className="text-sm font-medium">예측 수량</Label>
                <Input 
                  name="predictedQuantity" 
                  defaultValue={item.predictedQuantity} 
                  type="number" 
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mape" className="text-sm font-medium">MAPE</Label>
                <Input 
                  name="mape" 
                  defaultValue={item.mape ?? ''} 
                  type="number" 
                  step="0.0001" 
                  placeholder="선택사항"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="predictionModel" className="text-sm font-medium">예측 모델</Label>
                <Input 
                  name="predictionModel" 
                  defaultValue={item.predictionModel} 
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          <SheetFooter className="pt-4">
            <Button type="submit" className="w-full">
              변경사항 저장
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

const getModelBadgeVariant = (modelName: string): "default" | "secondary" | "outline" => {
  const variants: Array<"default" | "secondary" | "outline"> = ["default", "secondary", "outline"];
  let hash = 0;
  for (let i = 0; i < modelName.length; i++) {
    hash = modelName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return variants[Math.abs(hash % variants.length)];
};

function DraggableRow({ row }: { row: Row<Forecast> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.cofId,
  })
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
  }

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      data-state={row.getIsSelected() && "selected"}
      className={isDragging ? "shadow-lg" : ""}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="px-2 sm:px-4">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({
  data: initialData,
  onRunForecast,
  isForecasting,
}: {
  data: Forecast[];
  onRunForecast: () => Promise<void>;
  isForecasting: boolean;
}) {
  const [data, setData] = React.useState(() => initialData);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    // 모바일에서 일부 컬럼 숨김
    forecastGenerationDate: false,
    mape: false,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedRowForEdit, setSelectedRowForEdit] = React.useState<Forecast | null>(null);

  const handleOpenEditSheet = (row: Row<Forecast>) => {
    setSelectedRowForEdit(row.original);
    setIsSheetOpen(true);
  };

  const handleDeleteRow = async (cofId: number) => {
    if (!window.confirm(`정말로 ID ${cofId} 예측 데이터를 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/customer-forecast/${cofId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '삭제에 실패했습니다.');
      }
      setData(prevData => prevData.filter(row => row.cofId !== cofId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  };

  const handleSaveChanges = async (event: React.FormEvent<HTMLFormElement>, cofId: number) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updatedData = {
      predictedDate: formData.get('predictedDate') as string,
      predictedQuantity: Number(formData.get('predictedQuantity')),
      mape: formData.get('mape') ? Number(formData.get('mape')) : null,
      predictionModel: formData.get('predictionModel') as string,
    };

    try {
      const response = await fetch(`/api/customer-forecast/${cofId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (response.status === 204) {
        setData(prevData =>
          prevData.map(row =>
            row.cofId === cofId ? { ...row, ...updatedData, mape: updatedData.mape ?? row.mape } : row
          )
        );
        setIsSheetOpen(false);
      } else if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '수정에 실패했습니다.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  };

  React.useEffect(() => { 
    setData(initialData); 
    // 화면 크기에 따른 컬럼 가시성 조정
    const updateColumnVisibility = () => {
      const isMobile = window.innerWidth < 768;
      setColumnVisibility({
        forecastGenerationDate: !isMobile,
        mape: !isMobile,
      });
    };
    
    updateColumnVisibility();
    window.addEventListener('resize', updateColumnVisibility);
    return () => window.removeEventListener('resize', updateColumnVisibility);
  }, [initialData]);

  const columns: ColumnDef<Forecast>[] = [
    { 
      id: "drag", 
      header: () => null, 
      cell: ({ row }) => <DragHandle id={row.original.cofId} />,
      size: 40,
    },
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex justify-center">
          <Checkbox 
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")} 
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} 
            aria-label="Select all" 
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox 
            checked={row.getIsSelected()} 
            onCheckedChange={(value) => row.toggleSelected(!!value)} 
            aria-label="Select row" 
          />
        </div>
      ),
      enableSorting: false, 
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "companyName",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 px-2">
          회사명
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <Button 
          variant="link" 
          className="px-0 font-normal text-left justify-start h-auto py-1" 
          onClick={() => handleOpenEditSheet(row)}
        >
          <span className="truncate max-w-[150px] sm:max-w-[200px]">
            {row.original.companyName || row.original.customerName || `고객 ${row.original.customerId}`}
          </span>
        </Button>
      ),
    },
    {
      accessorKey: "predictedDate",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 px-2">
          예측일
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="sm:hidden">
            {new Date(row.getValue("predictedDate")).toLocaleDateString("ko-KR", {month: 'short', day: 'numeric'})}
          </div>
          <div className="hidden sm:block">
            {new Date(row.getValue("predictedDate")).toLocaleDateString("ko-KR", {year: 'numeric', month: 'short', day: 'numeric'})}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "predictedQuantity",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 px-2 w-full justify-end">
          예측수량
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {new Intl.NumberFormat('ko-KR').format(row.getValue("predictedQuantity"))}
        </div>
      ),
    },
    {
      accessorKey: "mape",
      header: () => <div className="text-center text-sm">MAPE</div>,
      cell: ({ row }) => {
        const mapeValue = row.getValue("mape");
        if (typeof mapeValue !== 'number' || isNaN(mapeValue)) {
          return (
            <div className="flex justify-center">
              <Badge variant="secondary" className="text-xs">N/A</Badge>
            </div>
          );
        }
        const mape = mapeValue * 100;
        const variant = mape < 10 ? "default" : mape < 25 ? "secondary" : "destructive";
        return (
          <div className="flex justify-center">
            <Badge variant={variant} className="text-xs">
              {mape.toFixed(1)}%
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "predictionModel",
      header: "모델",
      cell: ({ row }) => {
        const modelName = String(row.getValue("predictionModel"));
        return (
          <div className="flex justify-center">
            <Badge variant={getModelBadgeVariant(modelName)} className="text-xs max-w-[80px] truncate">
              {modelName}
            </Badge>
          </div>
        );
      },
    },
    { 
      accessorKey: "forecastGenerationDate", 
      header: "생성일", 
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {new Date(row.getValue("forecastGenerationDate")).toLocaleDateString("ko-KR")}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVerticalIcon className="h-4 w-4" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleOpenEditSheet(row)} className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" />
                수정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteRow(row.original.cofId)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      size: 50,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    onSortingChange: setSorting,
    getRowId: (row) => row.cofId.toString(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const dataIds = React.useMemo(() => data.map(({ cofId }) => cofId), [data]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setData((currentData) => {
        const oldIndex = dataIds.indexOf(active.id as number);
        const newIndex = dataIds.indexOf(over.id as number);
        return arrayMove(currentData, oldIndex, newIndex);
      });
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    let dataToExport: Forecast[];

    if (selectedRows.length > 0) {
      dataToExport = selectedRows.map(row => row.original);
    } else {
      dataToExport = table.getRowModel().rows.map(row => row.original);
    }

    if (dataToExport.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }
    
    let blob: Blob;
    let fileName: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      fileName = `forecast_export_${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      const headers = Object.keys(dataToExport[0]);
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => headers.map(header => JSON.stringify(row[header as keyof Forecast])).join(','))
      ].join('\n');
      blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      fileName = `forecast_export_${new Date().toISOString().slice(0, 10)}.csv`;
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {})
  );

  return (
    <div className="space-y-4">
      {/* 액션 버튼들 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button 
            onClick={onRunForecast} 
            disabled={isForecasting}
            className="w-full sm:w-auto"
          >
            <Play className="mr-2 h-4 w-4" />
            {isForecasting ? "예측 실행 중..." : "새 예측 실행"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {table.getFilteredSelectedRowModel().rows.length > 0
                    ? `선택된 ${table.getFilteredSelectedRowModel().rows.length}개 내보내기`
                    : "전체 내보내기"}
                </span>
                <span className="sm:hidden">내보내기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                CSV로 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                JSON으로 내보내기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    
      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter} 
            modifiers={[restrictToVerticalAxis]} 
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id} 
                          colSpan={header.colSpan}
                          className="px-2 sm:px-4 py-3 text-xs sm:text-sm"
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                      {table.getRowModel().rows.map((row) => (
                        <DraggableRow key={row.id} row={row} />
                      ))}
                    </SortableContext>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        결과가 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DndContext>
        </CardContent>
      </Card>

      <ForecastDetailSheet 
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        item={selectedRowForEdit}
        onSave={handleSaveChanges}
      />
      
      {/* 페이지네이션과 정보 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground order-2 sm:order-1">
          {table.getFilteredSelectedRowModel().rows.length}개 중 {table.getFilteredRowModel().rows.length}개 행이 선택됨
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6 order-1 sm:order-2">
          {/* 페이지 크기 선택 */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium whitespace-nowrap">페이지당 행 수</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 15, 20, 30, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 페이지 정보 */}
          <div className="flex items-center justify-center text-sm font-medium min-w-[100px]">
            {table.getPageCount() > 0 ? (
              <>페이지 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</>
            ) : (
              <>페이지 1 / 1</>
            )}
          </div>
          
          {/* 페이지네이션 버튼 */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden h-8 w-8 p-0 lg:flex" 
              onClick={() => table.setPageIndex(0)} 
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">첫 페이지로</span>
              <ChevronsLeftIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => table.previousPage()} 
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">이전 페이지</span>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => table.nextPage()} 
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">다음 페이지</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden h-8 w-8 p-0 lg:flex" 
              onClick={() => table.setPageIndex(table.getPageCount() - 1)} 
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">마지막 페이지로</span>
              <ChevronsRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
