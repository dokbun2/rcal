import React, { useState, useEffect, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Product {
  productName: string;
  modelName: string;
  price: number;
  supplyPrice?: number;
  adjustedPrice?: number;
  rentalInfos?: RentalInfo[];
  selectedPeriod?: number;
  totalRentalFee?: number;
  monthlyRentalFee?: number;
}

interface RentalInfo {
  period: number;
  discountRate: number;
  totalRentalFee: number;
  monthlyRentalFee: number;
}

interface DiscountRates {
  [key: number]: number;
}

const RentalCalculator: React.FC = () => {
  // 상태 관리
  const [products, setProducts] = useState<Product[]>([]);
  const [supplyRatePercent, setSupplyRatePercent] = useState<number>(75);
  const [rentalPeriods] = useState<number[]>([12, 24, 36, 48]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(12);
  const [discountRates, setDiscountRates] = useState<DiscountRates>({
    12: 102,
    24: 106,
    36: 111,
    48: 116
  });
  const [calculatedProducts, setCalculatedProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('upload'); // 'upload', 'settings', 'results'
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // 공급단가율 변경 핸들러
  const handleSupplyRateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setSupplyRatePercent(value);
    }
  };

  // 할인률 변경 핸들러
  const handleDiscountRateChange = (period: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setDiscountRates({
        ...discountRates,
        [period]: value
      });
    }
  };

  // 렌탈 기간 선택 핸들러
  const handlePeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(parseInt(e.target.value, 10));
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // 파일 형식 확인
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['xlsx', 'xls', 'csv'].includes(fileExtension)) {
      setError('지원되는 파일 형식은 xlsx, xls, csv입니다.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 파일 읽기
      const data = await readFile(file);
      setProducts(data);
      setFileUploaded(true);
      setLoading(false);
      setActiveTab('settings');
    } catch (err) {
      setError('파일 처리 중 오류가 발생했습니다: ' + (err as Error).message);
      setLoading(false);
    }
  };
  
  // 엑셀/CSV 파일 읽기 함수
  const readFile = (file: File): Promise<Product[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const data = e.target?.result;
          let parsedData: any[] = [];
          
          if (file.name.endsWith('.csv') && typeof data === 'string') {
            // CSV 파일 처리
            const result = Papa.parse(data, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true
            });
            
            if (result.errors && result.errors.length > 0) {
              console.error('CSV 파싱 오류:', result.errors);
              reject(new Error('CSV 파일 파싱 중 오류가 발생했습니다.'));
              return;
            }
            
            parsedData = result.data as any[];
          } else if (data) {
            try {
              // 엑셀 파일 처리
              let workbook;
              if (typeof data === 'string') {
                // base64 인코딩된 문자열
                workbook = XLSX.read(data, { type: 'binary', cellDates: true });
              } else {
                // ArrayBuffer
                const arrayBuffer = data as ArrayBuffer;
                workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
              }
              
              const sheetName = workbook.SheetNames[0];
              if (!sheetName) {
                reject(new Error('엑셀 파일에 시트가 없습니다.'));
                return;
              }
              
              const worksheet = workbook.Sheets[sheetName];
              parsedData = XLSX.utils.sheet_to_json(worksheet);
              
              // 콘솔에 파일 구조 출력 (디버깅용)
              console.log('파싱된 데이터 구조:', parsedData[0]);
            } catch (xlsxError) {
              console.error('엑셀 파싱 오류:', xlsxError);
              reject(new Error('엑셀 파일 파싱 중 오류가 발생했습니다.'));
              return;
            }
          }
          
          // 데이터가 비어있는지 확인
          if (!parsedData || parsedData.length === 0) {
            reject(new Error('파일에 데이터가 없거나 올바른 형식이 아닙니다.'));
            return;
          }
          
          // 필드 이름 매핑을 위한 함수
          const findField = (obj: any, possibleNames: string[]): string | undefined => {
            for (const name of possibleNames) {
              // 정확히 일치하는 필드 찾기
              if (obj[name] !== undefined) {
                return name;
              }
              
              // 공백을 제거하고 비교
              const nameWithoutSpaces = name.replace(/\s+/g, '');
              for (const key of Object.keys(obj)) {
                if (key.replace(/\s+/g, '').toLowerCase() === nameWithoutSpaces.toLowerCase()) {
                  return key;
                }
              }
            }
            return undefined;
          };
          
          // 첫 번째 행을 기반으로 필드 이름 찾기
          const firstRow = parsedData[0];
          
          // 제품명 필드 찾기
          const productNameField = findField(firstRow, ['제품명', '제 품 명', '제품', '품명', 'productName', 'product', 'name'] as string[]);
          
          // 모델명 필드 찾기
          const modelNameField = findField(firstRow, ['모델명', '모 델 명', '모델', 'modelName', 'model'] as string[]);
          
          // 가격 필드 찾기
          const priceField = findField(firstRow, ['일시불단가', '일시불 단가', '단가', '가격', '일시불', 'price'] as string[]);
          
          console.log('필드 매핑:', { productNameField, modelNameField, priceField });
          
          if (!productNameField || !modelNameField || !priceField) {
            const missingFields = [];
            if (!productNameField) missingFields.push('제품명');
            if (!modelNameField) missingFields.push('모델명');
            if (!priceField) missingFields.push('일시불 단가');
            
            reject(new Error(`파일에 필요한 필드(${missingFields.join(', ')})를 찾을 수 없습니다. 열 이름을 확인해주세요.`));
            return;
          }
          
          // 데이터 표준화 (필드명 통일)
          const standardizedData: Product[] = parsedData.map(item => ({
            productName: item[productNameField]?.toString() || '',
            modelName: item[modelNameField]?.toString() || '',
            price: parseFloat(item[priceField]?.toString().replace(/,/g, '') || '0')
          }));
          
          resolve(standardizedData);
        } catch (err) {
          console.error('파일 처리 중 오류:', err);
          reject(new Error('파일 처리 중 오류가 발생했습니다.'));
        }
      };
      
      reader.onerror = (err) => {
        console.error('파일 읽기 오류:', err);
        reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
      };
      
      try {
        if (file.name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      } catch (readError) {
        console.error('파일 읽기 시도 오류:', readError);
        reject(new Error('파일 읽기를 시도하는 중 오류가 발생했습니다.'));
      }
    });
  };
  
  // 렌탈료 계산 함수
  const calculateRental = () => {
    if (products.length === 0) {
      setError('계산할 제품 데이터가 없습니다. 파일을 먼저 업로드해주세요.');
      return;
    }
    
    try {
      const calculated = products.map(product => {
        // 1. 공급단가 계산 (일시불 단가 × 공급단가율)
        const supplyPrice = product.price * (supplyRatePercent / 100);
        
        // 2. 조정단가 계산 (십단위 반올림)
        const adjustedPrice = Math.round(supplyPrice / 10) * 10;
        
        // 3. 각 렌탈 기간별 총렌탈료 및 월렌탈료 계산
        const rentalInfos = rentalPeriods.map(period => {
          const discountRate = discountRates[period] / 100;
          const totalRentalFee = product.price * discountRate;
          const monthlyRentalFee = Math.round(totalRentalFee / period);
          
          return {
            period,
            discountRate: discountRates[period],
            totalRentalFee,
            monthlyRentalFee
          };
        });
        
        // 4. 선택된 렌탈 기간에 대한 정보
        const selectedRentalInfo = rentalInfos.find(info => info.period === selectedPeriod);
        
        return {
          ...product,
          supplyPrice,
          adjustedPrice,
          rentalInfos,
          selectedPeriod,
          totalRentalFee: selectedRentalInfo ? selectedRentalInfo.totalRentalFee : 0,
          monthlyRentalFee: selectedRentalInfo ? selectedRentalInfo.monthlyRentalFee : 0
        };
      });
      
      setCalculatedProducts(calculated);
      if(calculated.length > 0 && activeTab !== 'results') {
        setActiveTab('results');
      }
    } catch (err) {
      setError('계산 중 오류가 발생했습니다: ' + (err as Error).message);
    }
  };
  
  // 공급단가율이나 할인률, 선택된 기간이 변경될 때마다 자동 계산
  useEffect(() => {
    if (fileUploaded && products.length > 0) {
      calculateRental();
    }
  }, [supplyRatePercent, discountRates, selectedPeriod, fileUploaded]);
  
  // 샘플 데이터 생성 함수
  const generateSampleData = () => {
    const sampleData: Product[] = [
      { productName: '에어컨', modelName: 'AC-2000', price: 1200000 },
      { productName: '냉장고', modelName: 'REF-500', price: 1500000 },
      { productName: '세탁기', modelName: 'WM-100', price: 800000 },
      { productName: '건조기', modelName: 'DRY-200', price: 950000 },
      { productName: '식기세척기', modelName: 'DW-300', price: 680000 },
    ];
    
    setProducts(sampleData);
    setFileUploaded(true);
    setActiveTab('settings');
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: any) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        // 브라우저에서 지원하지 않을 수 있어 try-catch로 감싸기
        try {
          // IE용 방법
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
        } catch (err) {
          console.error('파일 설정 실패:', err);
        }
        handleFileUpload({ target: { files: e.dataTransfer.files } });
      }
    }
  };
  
  // 렌더링
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            레이션 계산기
          </h1>
          
          {/* 탭 네비게이션 */}
          <div className="flex border-b mb-6">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'upload' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                파일 업로드
              </span>
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'settings' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => fileUploaded ? setActiveTab('settings') : null}
              disabled={!fileUploaded}
            >
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                계산 설정
              </span>
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'results' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => calculatedProducts.length > 0 ? setActiveTab('results') : null}
              disabled={calculatedProducts.length === 0}
            >
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                계산 결과
              </span>
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6 flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                <p className="text-gray-700">파일 처리 중...</p>
              </div>
            </div>
          )}
          
          {/* 파일 업로드 섹션 */}
          {activeTab === 'upload' && (
            <div className="mb-8 transition-all duration-300 ease-in-out">
              <div 
                className={`flex flex-col items-center justify-center p-8 border-2 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-dashed border-gray-300 bg-gray-50'} rounded-xl cursor-pointer transition-all duration-200`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  const fileInput = document.getElementById('file-upload');
                  if (fileInput) {
                    fileInput.click();
                  }
                }}
              >
                <div className="w-24 h-24 mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </div>
                
                <h3 className="text-xl font-medium mb-2 text-gray-700">파일을 드래그하거나 클릭하여 업로드</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  제품명, 모델명, 일시불 단가가 포함된 엑셀 또는 CSV 파일을 업로드하세요
                </p>
                
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">.xlsx</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">.xls</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">.csv</span>
                </div>
                
                <input 
                  id="file-upload"
                  type="file" 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileUpload} 
                />
              </div>
              
              <div className="mt-6 flex justify-center">
                <button 
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                  onClick={generateSampleData}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  샘플 데이터로 시작하기
                </button>
              </div>
              
              <div className="mt-12 p-5 bg-blue-50 border border-blue-100 rounded-xl">
                <h3 className="text-lg font-medium mb-2 text-blue-800 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  사용 안내
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  엑셀 파일은 다음과 같은 열을 포함해야 합니다:
                </p>
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-center text-blue-800 font-medium">제품명</div>
                    <div className="p-2 bg-blue-50 rounded text-center text-blue-800 font-medium">모델명</div>
                    <div className="p-2 bg-blue-50 rounded text-center text-blue-800 font-medium">일시불단가</div>
                  </div>
                </div>
                <p className="text-sm text-blue-700">
                  파일 업로드 후 공급단가율과 할인률을 설정하여 월 렌탈료를 계산할 수 있습니다.
                </p>
              </div>
            </div>
          )}
          
          {/* 계산 설정 섹션 */}
          {activeTab === 'settings' && fileUploaded && (
            <div className="mb-8 transition-all duration-300 ease-in-out">
              <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                  </svg>
                  업로드 된 제품 데이터
                </h3>
                <p className="text-sm text-blue-700">
                  총 {products.length}개 제품이 로드되었습니다.
                </p>
              </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* 공급단가율 설정 */}
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 transition-all duration-200 hover:shadow-lg">
                  <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                    </svg>
                    공급단가율 설정
                  </h3>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={supplyRatePercent}
                      onChange={handleSupplyRateChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    공급단가 = 일시불 단가 × 공급단가율<br />
                    조정단가 = 공급단가 십단위 반올림
                  </p>
                </div>
                
                {/* 렌탈 기간 선택 */}
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 transition-all duration-200 hover:shadow-lg">
                  <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    렌탈 기간 선택
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {rentalPeriods.map(period => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`py-3 rounded-lg font-medium transition-all duration-200 ${
                          selectedPeriod === period 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {period}개월
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 할인률 설정 */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8 transition-all duration-200 hover:shadow-lg">
                <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  할인률 설정
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  각 렌탈 기간별로 일시불 단가에 곱해지는 할인률입니다. 총렌탈료 = 일시불 단가 × 할인률
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {rentalPeriods.map(period => (
                    <div key={period} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-700">{period}개월</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${selectedPeriod === period ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                          {selectedPeriod === period ? '선택됨' : ''}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          value={discountRates[period]}
                          onChange={(e) => handleDiscountRateChange(period, e)}
                          className={`w-full px-3 py-2 border rounded-lg transition-all duration-200 ${selectedPeriod === period ? 'border-blue-300 focus:ring-2 focus:ring-blue-500' : 'border-gray-300'}`}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-center">
                <button 
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                  onClick={calculateRental}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m-3-3v6m3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  계산하기
                </button>
              </div>
            </div>
          )}
          
          {/* 계산 결과 섹션 */}
          {activeTab === 'results' && calculatedProducts.length > 0 && (
            <div className="transition-all duration-300 ease-in-out">
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">
                  렌탈 계산 결과 ({selectedPeriod}개월)
                </h3>
                
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-gray-600">선택된 할인율: {discountRates[selectedPeriod]}%</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    총 {calculatedProducts.length}개 제품
                  </span>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제품명</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">모델명</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일시불 단가</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">공급단가</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 렌탈료</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">월 렌탈료</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {calculatedProducts.map((product, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.modelName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.price.toLocaleString()}원</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{Math.round(product.supplyPrice || 0).toLocaleString()}원</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{Math.round(product.totalRentalFee || 0).toLocaleString()}원</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">{(product.monthlyRentalFee || 0).toLocaleString()}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">선택된 렌탈 기간</h4>
                  <p className="text-2xl font-bold text-gray-800">{selectedPeriod} 개월</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">평균 렌탈 총액</h4>
                  <p className="text-2xl font-bold text-gray-800">
                    {(calculatedProducts.reduce((sum, product) => sum + (product.totalRentalFee || 0), 0) / calculatedProducts.length).toLocaleString()}원
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">평균 월 렌탈료</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {(calculatedProducts.reduce((sum, product) => sum + (product.monthlyRentalFee || 0), 0) / calculatedProducts.length).toLocaleString()}원
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between">
                <button 
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 flex items-center"
                  onClick={() => setActiveTab('settings')}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                  계산설정가기
                </button>
                
                <button 
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all duration-200 flex items-center"
                  onClick={() => {
                    // 엑셀 파일로 내보내기
                    const worksheet = XLSX.utils.json_to_sheet(calculatedProducts.map(p => ({
                      '제품명': p.productName,
                      '모델명': p.modelName,
                      '일시불 단가': p.price,
                      '공급단가': p.supplyPrice,
                      '조정단가': p.adjustedPrice,
                      '총 렌탈료': p.totalRentalFee,
                      '월 렌탈료': p.monthlyRentalFee,
                      '렌탈 기간': `${p.selectedPeriod}개월`
                    })));
                    
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, '렌탈 계산 결과');
                    
                    XLSX.writeFile(workbook, `렌탈계산결과_${selectedPeriod}개월_${new Date().toISOString().split('T')[0]}.xlsx`);
                  }}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  결과 내보내기 (Excel)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentalCalculator;