export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export const createBackupFile = async (accessToken: string, fileName: string, content: string): Promise<string> => {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'Backup do Sistema Munago Mecânica',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Falha ao criar arquivo no Google Drive');
  }

  const data = await response.json();
  return data.id;
};

export const getFileContent = async (accessToken: string, fileId: string): Promise<string> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Falha ao obter conteúdo do backup');
  }

  return response.text();
};

export const listBackups = async (accessToken: string): Promise<DriveFile[]> => {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=name contains "backup_estoque_" and trashed = false&fields=files(id, name, mimeType)',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Falha ao listar backups do Google Drive');
  }

  const data = await response.json();
  return data.files || [];
};
