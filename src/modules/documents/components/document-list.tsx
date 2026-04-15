"use client";

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileIcon, 
  Download, 
  Trash2, 
  AlertCircle, 
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Document {
  id: string;
  name: string;
  category: string;
  valid_until: string | null;
  status: 'valid' | 'expiring' | 'expired';
  file_path: string;
}

export function DocumentList({ 
  documents, 
  onDelete, 
  onDownload 
}: { 
  documents: Document[], 
  onDelete: (id: string, path: string) => void,
  onDownload: (path: string) => void
}) {
  
  const getStatusBadge = (doc: Document) => {
    if (!doc.valid_until) return <Badge variant="secondary">Permanente</Badge>;
    
    const expiryDate = new Date(doc.valid_until);
    const today = new Date();
    const warningPeriod = addDays(today, 30);

    if (isBefore(expiryDate, today)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" />
          Vencido
        </Badge>
      );
    }

    if (isBefore(expiryDate, warningPeriod)) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
          <Clock className="size-3" />
          Vence em breve
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
        <CheckCircle2 className="size-3" />
        Válido
      </Badge>
    );
  };

  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length > 0 ? (
            documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileIcon className="size-4 text-muted-foreground" />
                    <span>{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-normal uppercase">
                    {doc.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  {doc.valid_until ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {format(new Date(doc.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(doc)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-8"
                    onClick={() => onDownload(doc.file_path)}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(doc.id, doc.file_path)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                Nenhum documento anexado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
