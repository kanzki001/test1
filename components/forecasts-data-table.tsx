"use client"

import * as React from "react"
import {
  ArrowUpDown,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  GripVerticalIcon,
  MoreVerticalIcon,
  PlusIcon,
  Play,
  Download,
  Edit,
  Trash2,
} from "lucide-react"

// shadcn/ui 컴포넌트 imports
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// 유틸리티 함수
function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// API 응답에 맞는 타입 정의
export type Forecast = {
  cofId: number;
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  companySize: string | null;
  predictedDate: string;
  predictedQuantity: number;
  mape: number | null;
  predictionModel: string;
  probability: number | null;
  forecastGenerationDate: string;
};

// 정렬 상태 타입
type SortingState = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

// Create a separate component for the drag handle
function DragHandle({ id }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const getModelBadgeVariant = (modelName) => {
  if (!modelName || typeof modelName !== 'string') {
    return "secondary";
  }
  
  const variants = ["default", "secondary", "outline"];
  let hash = 0;
  for (let i = 0; i < modelName.length; i++) {
    hash = modelName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return variants[Math.abs(hash % variants.length)];
};

const getCompanySizeBadgeColor = (size) => {
  if (!size || typeof size !== 'string') {
    return "bg-gray-100 text-gray-800";
  }
  
  switch (size) {
    case "대기업":
      return "bg-blue-100 text-blue-800"
    case "중견기업":
      return "bg-green-100 text-green-800"
    case "중소기업":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
};

// 정렬 가능한 헤더 컴포넌트
function SortableHeader({ column, children, onSort, sortState }) {
  const handleSort = () => {
    let newDirection = 'asc';
    if (sortState.key === column && sortState.direction === 'asc') {
      newDirection = 'desc';
    } else if (sortState.key === column && sortState.direction === 'desc') {
      newDirection = null;
    }
    onSort(column, newDirection);
  };

  const getSortIcon = () => {
    if (sortState.key !== column || !sortState.direction) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return (
      <ArrowUpDown 
        className={`ml-2 h-4 w-4 ${
          sortState.direction === 'asc' ? 'rotate-180' : ''
        }`} 
      />
    );
  };

  return (
    <div className="text-center">
      <Button
        variant="ghost"
        onClick={handleSort}
        className="h-8 px-2"
      >
        {children}
        {getSortIcon()}
      </Button>
    </div>
  );
}

// 테이블 셀 뷰어 컴포넌트
function ForecastTableCellViewer({ item, onSave, triggerRef }) {
  const displayName = item.companyName || item.customerName || `고객 ${item.customerId}`;
  const [isOpen, setIsOpen] = React.useState(false);
  
  React.useImperativeHandle(triggerRef, () => ({
    openSheet: () => setIsOpen(true)
  }));

  const handleSave = () => {
    const form = document.getElementById(`edit-form-${item.cofId}`);
    const formData = new FormData(form);
    
    const fakeEvent = {
      preventDefault: () => {},
      currentTarget: {
        get: (name) => formData.get(name)
      }
    };
    
    onSave(fakeEvent, item.cofId);
    setIsOpen(false);
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {displayName}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader className="gap-1">
          <SheetTitle>{displayName}</SheetTitle>
          <SheetDescription>예측 데이터 수정</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
          <Separator />
          <div className="grid gap-2">
            <div className="flex gap-2 font-medium leading-none">
              예측 정보
            </div>
            <div className="text-muted-foreground">
              {displayName}의 예측 데이터를 수정합니다.
            </div>
          </div>
          <Separator />
          <form id={`edit-form-${item.cofId}`} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="predictedDate">예측 날짜</Label>
                <Input 
                  id="predictedDate"
                  name="predictedDate" 
                  defaultValue={new Date(item.predictedDate).toISOString().split("T")[0]} 
                  type="date" 
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="predictedQuantity">예측 수량</Label>
                <Input 
                  id="predictedQuantity"
                  name="predictedQuantity" 
                  defaultValue={item.predictedQuantity} 
                  type="number" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="mape">MAPE</Label>
                <Input 
                  id="mape"
                  name="mape" 
                  defaultValue={item.mape ?? ''} 
                  type="number" 
                  step="0.0001" 
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="probability">확률</Label>
                <Input 
                  id="probability"
                  name="probability" 
                  defaultValue={item.probability ?? ''} 
                  type="number" 
                  step="0.01"
                  min="0"
                  max="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="predictionModel">예측 모델</Label>
                <Input 
                  id="predictionModel"
                  name="predictionModel" 
                  defaultValue={item.predictionModel || ''} 
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="companySize">회사 규모</Label>
                <Input 
                  id="companySize"
                  defaultValue={item.companySize || ''} 
                  disabled 
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="companyName">회사명</Label>
              <Input id="companyName" defaultValue={displayName} disabled className="bg-muted" />
            </div>
          </form>
        </div>
        <SheetFooter className="mt-auto flex gap-2 sm:flex-col sm:space-x-0">
          <Button 
            className="w-full"
            onClick={handleSave}
          >
            변경사항 저장
          </Button>
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              취소
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function DraggableRow({ row, onEdit, onDelete, columnVisibility }) {
  const displayName = row.original.companyName || row.original.customerName || `고객 ${row.original.customerId}`;
  const sheetTriggerRef = React.useRef();
  
  const handleEditClick = () => {
    if (sheetTriggerRef.current) {
      sheetTriggerRef.current.openSheet();
    }
  };
  
  return (
    <tr
      className={cn(
        "relative z-0 border-b transition-colors hover:bg-muted/50",
        row.isSelected && "bg-muted"
      )}
    >
      <td className="p-4">
        <DragHandle id={row.original.cofId} />
      </td>
      <td className="p-4">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.isSelected}
            onCheckedChange={(value) => row.toggleSelected && row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      </td>
      <td className="p-4">
        <div className="text-center">
          <ForecastTableCellViewer 
            item={row.original} 
            onSave={onEdit} 
            triggerRef={sheetTriggerRef}
          />
        </div>
      </td>
      <td className="p-4">
        <div className="text-center font-mono text-sm">
          {new Date(row.original.predictedDate).toLocaleDateString("ko-KR")}
        </div>
      </td>
      <td className="p-4">
        <div className="text-center font-mono text-sm">
          {new Intl.NumberFormat('ko-KR').format(row.original.predictedQuantity)}
        </div>
      </td>
      {columnVisibility.mape && (
        <td className="p-4">
          <div className="flex justify-center">
            {typeof row.original.mape === 'number' && !isNaN(row.original.mape) ? (
              <Badge variant={row.original.mape < 0.1 ? "default" : row.original.mape < 0.25 ? "secondary" : "destructive"}>
                {(row.original.mape * 100).toFixed(1)}%
              </Badge>
            ) : (
              <Badge variant="secondary">N/A</Badge>
            )}
          </div>
        </td>
      )}
      {columnVisibility.companySize && (
        <td className="p-4">
          <div className="flex justify-center">
            {row.original.companySize ? (
              <Badge variant="outline" className={`px-1.5 text-muted-foreground ${getCompanySizeBadgeColor(row.original.companySize)}`}>
                {row.original.companySize}
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-1.5 text-muted-foreground">
                N/A
              </Badge>
            )}
          </div>
        </td>
      )}
      {columnVisibility.predictionModel && (
        <td className="p-4">
          <div className="flex justify-center">
            {row.original.predictionModel ? (
              <Badge variant={getModelBadgeVariant(row.original.predictionModel)} className="px-1.5 text-muted-foreground">
                {row.original.predictionModel}
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-1.5 text-muted-foreground">
                N/A
              </Badge>
            )}
          </div>
        </td>
      )}
      {columnVisibility.forecastGenerationDate && (
        <td className="p-4">
          <div className="text-center font-mono text-sm text-muted-foreground">
            {row.original.forecastGenerationDate && new Date(row.original.forecastGenerationDate).toLocaleDateString("ko-KR")}
          </div>
        </td>
      )}
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex size-8 text-muted-foreground data-[state=open]:bg-muted" size="icon">
              <MoreVerticalIcon />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={handleEditClick}>
              <Edit className="mr-2 h-4 w-4" />
              수정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(row.original.cofId)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

export function DataTable({
  data = [],
  onRunForecast = () => {},
  isForecasting = false,
  selectedCompanyName = null,
}) {
  const [tableData, setTableData] = React.useState(() => data);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({
    mape: true,
    companySize: true,
    predictionModel: true,
    forecastGenerationDate: false,
  });
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sortState, setSortState] = React.useState<SortingState>({
    key: '',
    direction: null
  });

  // 정렬 함수
  const handleSort = (key: string, direction: 'asc' | 'desc' | null) => {
    setSortState({ key, direction });
    
    if (!direction) {
      // 정렬 해제 - 원본 순서로 복원
      setTableData([...data]);
      return;
    }

    const sortedData = [...tableData].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      // 회사명 특별 처리 (companyName 또는 customerName 사용)
      if (key === 'companyName') {
        aValue = a.companyName || a.customerName || `고객 ${a.customerId}`;
        bValue = b.companyName || b.customerName || `고객 ${b.customerId}`;
      }

      // 날짜 필드 처리
      if (key === 'predictedDate' || key === 'forecastGenerationDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // 숫자 필드 처리
      if (key === 'predictedQuantity' || key === 'mape' || key === 'probability') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      // 문자열 필드 처리
      if (typeof aValue === 'string') {
        aValue = aValue?.toLowerCase() || '';
        bValue = bValue?.toLowerCase() || '';
      }

      // null/undefined 처리
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return direction === 'asc' ? 1 : -1;
      if (bValue == null) return direction === 'asc' ? -1 : 1;

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setTableData(sortedData);
  };

  const handleDeleteRow = async (cofId) => {
    if (!window.confirm(`정말로 ID ${cofId} 예측 데이터를 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/customer-forecast/${cofId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '삭제에 실패했습니다.');
      }
      setTableData(prevData => prevData.filter(row => row.cofId !== cofId));
      alert('성공적으로 삭제되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  };

  const handleSaveChanges = async (event, cofId) => {
    event.preventDefault();
    
    const updatedData = {
      predictedDate: event.currentTarget.get('predictedDate'),
      predictedQuantity: Number(event.currentTarget.get('predictedQuantity')),
      mape: event.currentTarget.get('mape') ? Number(event.currentTarget.get('mape')) : null,
      probability: event.currentTarget.get('probability') ? Number(event.currentTarget.get('probability')) : null,
      predictionModel: event.currentTarget.get('predictionModel'),
    };

    try {
      const response = await fetch(`/api/customer-forecast/${cofId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (response.status === 204) {
        setTableData(prevData =>
          prevData.map(row =>
            row.cofId === cofId ? { 
              ...row, 
              ...updatedData, 
              mape: updatedData.mape ?? row.mape,
              probability: updatedData.probability ?? row.probability
            } : row
          )
        );
        alert('성공적으로 수정되었습니다.');
      } else if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '수정에 실패했습니다.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  };

  const handleExport = (format) => {
    const selectedData = Object.keys(rowSelection).length > 0 
      ? tableData.filter(item => rowSelection[item.cofId.toString()])
      : tableData; // 전체 데이터 내보내기

    if (selectedData.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }
    
    // 파일명에 회사명 추가
    const companyNamePart = selectedCompanyName ? `_${selectedCompanyName.replace(/[^\w가-힣]/g, '_')}` : '';
    const datePart = new Date().toISOString().slice(0, 10);
    
    let blob;
    let fileName;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
      fileName = `forecast_export${companyNamePart}_${datePart}.json`;
    } else {
      const headers = Object.keys(selectedData[0]);
      const csvContent = [
        headers.join(','),
        ...selectedData.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
      ].join('\n');
      blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      fileName = `forecast_export${companyNamePart}_${datePart}.csv`;
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

  React.useEffect(() => { 
    setTableData(data);
    setRowSelection({});
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setSortState({ key: '', direction: null }); // 정렬 상태도 초기화
  }, [data]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(tableData.length / pagination.pageSize);
  const startIndex = pagination.pageIndex * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedData = tableData.slice(startIndex, endIndex);

  const toggleRowSelection = (cofId) => {
    setRowSelection(prev => ({
      ...prev,
      [cofId]: !prev[cofId]
    }));
  };

  const toggleAllRowsSelection = () => {
    const allSelected = paginatedData.every(item => rowSelection[item.cofId.toString()]);
    const newSelection = {};
    if (!allSelected) {
      paginatedData.forEach(item => {
        newSelection[item.cofId.toString()] = true;
      });
    }
    setRowSelection(newSelection);
  };

  const columns = [
    { key: 'mape', label: 'MAPE' },
    { key: 'companySize', label: '회사 규모' },
    { key: 'predictionModel', label: '예측 모델' },
    { key: 'forecastGenerationDate', label: '생성일' }
  ];

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  // 표시될 컬럼 수 계산 (기본 컬럼 5개 + 조건부 컬럼들 + 액션 컬럼 1개)
  const totalColumns = 6 + Object.values(columnVisibility).filter(Boolean).length;

  return (
    <div className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Button 
            onClick={onRunForecast} 
            disabled={isForecasting}
            variant="outline"
            size="sm"
          >
            <Play className="mr-2 h-4 w-4" />
            {isForecasting ? "예측 실행 중..." : "새 예측 실행"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                내보내기
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                CSV로 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                JSON으로 내보내기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">컬럼 설정</span>
                <span className="lg:hidden">컬럼</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key]}
                  onCheckedChange={(checked) => 
                    setColumnVisibility(prev => ({ ...prev, [column.key]: checked }))
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"></th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={paginatedData.length > 0 && paginatedData.every(item => rowSelection[item.cofId.toString()])}
                      onCheckedChange={toggleAllRowsSelection}
                      aria-label="Select all"
                    />
                  </div>
                </th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                  <SortableHeader 
                    column="companyName" 
                    onSort={handleSort} 
                    sortState={sortState}
                  >
                    회사명
                  </SortableHeader>
                </th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                  <SortableHeader 
                    column="predictedDate" 
                    onSort={handleSort} 
                    sortState={sortState}
                  >
                    예측일
                  </SortableHeader>
                </th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                  <SortableHeader 
                    column="predictedQuantity" 
                    onSort={handleSort} 
                    sortState={sortState}
                  >
                    예측수량
                  </SortableHeader>
                </th>
                {columnVisibility.mape && (
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                    <SortableHeader 
                      column="mape" 
                      onSort={handleSort} 
                      sortState={sortState}
                    >
                      MAPE
                    </SortableHeader>
                  </th>
                )}
                {columnVisibility.companySize && (
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                    <SortableHeader 
                      column="companySize" 
                      onSort={handleSort} 
                      sortState={sortState}
                    >
                      회사 규모
                    </SortableHeader>
                  </th>
                )}
                {columnVisibility.predictionModel && (
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                    <SortableHeader 
                      column="predictionModel" 
                      onSort={handleSort} 
                      sortState={sortState}
                    >
                      예측 모델
                    </SortableHeader>
                  </th>
                )}
                {columnVisibility.forecastGenerationDate && (
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                    <SortableHeader 
                      column="forecastGenerationDate" 
                      onSort={handleSort} 
                      sortState={sortState}
                    >
                      생성일
                    </SortableHeader>
                  </th>
                )}
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                paginatedData.map((item) => (
                  <DraggableRow 
                    key={item.cofId} 
                    row={{
                      original: item,
                      isSelected: !!rowSelection[item.cofId.toString()],
                      toggleSelected: () => toggleRowSelection(item.cofId.toString())
                    }}
                    onEdit={handleSaveChanges}
                    onDelete={handleDeleteRow}
                    columnVisibility={columnVisibility}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={totalColumns} className="h-24 text-center">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {selectedCount}개 중 {tableData.length}개 예측이 선택됨
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                페이지당 행 수
              </Label>
              <Select
                value={`${pagination.pageSize}`}
                onValueChange={(value) => {
                  setPagination(prev => ({ ...prev, pageSize: Number(value), pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              페이지 {pagination.pageIndex + 1} / {totalPages || 1}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: 0 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                disabled={pagination.pageIndex >= totalPages - 1}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: totalPages - 1 }))}
                disabled={pagination.pageIndex >= totalPages - 1}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}