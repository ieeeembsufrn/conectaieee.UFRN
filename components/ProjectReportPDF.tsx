import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        paddingTop: 40,
        paddingHorizontal: 40,
        paddingBottom: 58,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#1e40af',
        paddingBottom: 15,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 11,
        color: '#4B5563',
        marginBottom: 4,
    },
    badge: {
        fontSize: 9,
        backgroundColor: '#F3F4F6',
        color: '#374151',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 4,
        marginTop: 4,
    },
    section: {
        marginTop: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e40af',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    gridItem: {
        width: '50%',
        marginBottom: 10,
    },
    text: {
        fontSize: 10,
        color: '#374151',
        lineHeight: 1.6,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#111827',
    },
    taskContainer: {
        marginBottom: 14,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
    },
    taskTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    taskTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#111827',
        width: '78%',
        lineHeight: 1.25,
    },
    statusLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        textTransform: 'uppercase',
        maxWidth: '20%',
        textAlign: 'center',
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    metaItem: {
        width: '33.333%',
        paddingRight: 8,
        marginBottom: 6,
    },
    metaItemFull: {
        width: '100%',
        paddingRight: 0,
        marginBottom: 8,
    },
    metaLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 10,
        color: '#374151',
        lineHeight: 1.35,
    },
    descriptionBlock: {
        marginTop: 2,
        marginBottom: 8,
    },
    descriptionLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#6B7280',
        marginBottom: 4,
    },
    descriptionText: {
        fontSize: 10,
        color: '#374151',
        lineHeight: 1.45,
    },
    priorityBadge: {
        fontSize: 8,
        fontWeight: 'bold',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        textTransform: 'uppercase',
    },
    tag: {
        fontSize: 8,
        backgroundColor: '#EFF6FF',
        color: '#2563EB',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        marginRight: 3,
        marginBottom: 3,
    },
    link: {
        color: '#2563EB',
        fontSize: 9,
        textDecoration: 'none',
        marginTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        fontSize: 8,
        textAlign: 'center',
        color: '#9CA3AF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    }
});

interface ProjectReportPDFProps {
    project: any;
    tasks: any[];
    users?: any[];
}

export const ProjectReportPDF: React.FC<ProjectReportPDFProps> = ({ project, tasks, users = [] }) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const getAssignedUserNames = (task: any) => {
        if (!task.responsavelIds || !users.length) return 'Ninguém atribuído';
        const assigned = users.filter(u => task.responsavelIds.includes(u.id));
        return assigned.length > 0 ? assigned.map(u => u.nome).join(', ') : 'Ninguém atribuído';
    };

    const formatMultilineText = (value: any) => {
        if (!value) return '';
        return String(value)
            .replace(/\r\n/g, '\n')
            .replace(/\t/g, '    ');
    };

    const formatBreakableText = (value: any) => {
        return formatMultilineText(value)
            .replace(/([/?#=&._-])/g, '$1 ');
    };

    const getStatusStyles = (status: string) => {
        const colors: Record<string, any> = {
            todo: { bg: '#F3F4F6', text: '#374151' },
            doing: { bg: '#DBEAFE', text: '#1E40AF' },
            review: { bg: '#FEF3C7', text: '#92400E' },
            done: { bg: '#D1FAE5', text: '#065F46' },
            archived: { bg: '#E5E7EB', text: '#6B7280' },
        };
        const style = colors[status] || colors.todo;
        return { backgroundColor: style.bg, color: style.text };
    };

    const getPriorityStyles = (priority: string) => {
        const p = priority?.toLowerCase();
        const colors: Record<string, any> = {
            urgente: { bg: '#FEE2E2', text: '#991B1B' },
            alta: { bg: '#FFEDD5', text: '#9A3412' },
            média: { bg: '#FEF9C3', text: '#854D0E' },
            baixa: { bg: '#DCFCE7', text: '#166534' },
        };
        const style = colors[p] || { bg: '#F3F4F6', text: '#374151' };
        return { backgroundColor: style.bg, color: style.text };
    };

    const parseTaskResources = (task: any) => {
        const rawContent = task.content_url ?? task.url;
        if (!rawContent) return [];
        try {
            const content = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
            return Array.isArray(content) ? content : [{ value: rawContent }];
        } catch {
            return [{ value: rawContent }];
        }
    };

    const allMembers = [
        ...(project.owners || []),
        ...(project.team || [])
    ];
    const memberNames = allMembers.map(m => m.full_name || m.nome).join(', ') || 'Nenhum integrante';

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.title}>{project.nome}</Text>
                    <View style={styles.row}>
                        {project.parceria && <Text style={[styles.badge, { backgroundColor: '#F3E8FF', color: '#7E22CE' }]}>Parceria</Text>}
                        {project.capitulos && project.capitulos.map((cap: any) => (
                            <Text key={cap.id} style={styles.badge}>{cap.sigla}</Text>
                        ))}
                    </View>
                    <View style={[styles.row, { marginTop: 10 }]}>
                        <View style={styles.gridItem}>
                            <Text style={styles.subtitle}><Text style={styles.label}>Responsável principal: </Text>{project.responsavel || 'Não informado'}</Text>
                            <Text style={styles.subtitle}><Text style={styles.label}>Capítulo: </Text>{project.capitulo || 'Não informado'}</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text style={styles.subtitle}><Text style={styles.label}>Período: </Text>{formatDate(project.dataInicio)} - {formatDate(project.dataFim)}</Text>
                            <Text style={styles.subtitle}><Text style={styles.label}>Progresso: </Text>{project.progresso}%</Text>
                        </View>
                    </View>
                    {allMembers.length > 0 && (
                        <View style={{ marginTop: 2 }}>
                            <Text style={styles.subtitle}><Text style={styles.label}>Equipe: </Text>{memberNames}</Text>
                        </View>
                    )}
                </View>

                {/* About Project */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sobre o Projeto</Text>
                    <Text style={styles.text}>{project.descricao || 'Sem descrição.'}</Text>

                    {!!project.tags && project.tags.length > 0 && (
                        <View style={[styles.row, { marginTop: 8 }]}>
                            {project.tags.map((tag: string) => (
                                <Text key={tag} style={styles.tag}># {tag}</Text>
                            ))}
                        </View>
                    )}

                    {!!project.notes && (
                        <View style={{ marginTop: 15, padding: 10, backgroundColor: '#F9FAFB' }}>
                            <Text style={[styles.label, { marginBottom: 5 }]}>Anotações do Projeto:</Text>
                            <Text style={styles.text}>{project.notes}</Text>
                        </View>
                    )}

                    {!!project.links && project.links.length > 0 && (
                        <View style={{ marginTop: 15 }}>
                            <Text style={[styles.label, { marginBottom: 5 }]}>Links de Referência:</Text>
                            {project.links.map((link: any, index: number) => (
                                <Text key={index} style={styles.link}>• {link.title || 'Link'}: {link.url}</Text>
                            ))}
                        </View>
                    )}
                </View>


                {/* Tasks Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detalhamento das Tarefas ({tasks.length})</Text>

                    {tasks.map((task) => {
                        const resources = parseTaskResources(task);
                        return (
                            <View key={task.id} style={styles.taskContainer}>
                                <View style={styles.taskTop}>
                                    <Text style={styles.taskTitle}>{task.titulo}</Text>
                                    <Text style={[styles.statusLabel, getStatusStyles(task.status)]}>
                                        {task.status}
                                    </Text>
                                </View>

                                <View style={styles.metaGrid}>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Prioridade</Text>
                                        <Text style={[styles.priorityBadge, getPriorityStyles(task.prioridade)]}>
                                            {" "}{task.prioridade?.toUpperCase() || '-'}{" "}
                                        </Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Início</Text>
                                        <Text style={styles.metaValue}>{formatDate(task.dataInicio)}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Prazo</Text>
                                        <Text style={styles.metaValue}>{formatDate(task.prazo)}</Text>
                                    </View>
                                    <View style={styles.metaItemFull}>
                                        <Text style={styles.metaLabel}>Atribuído a</Text>
                                        <Text style={styles.metaValue}>{getAssignedUserNames(task)}</Text>
                                    </View>
                                </View>

                                {!!task.descricao && (
                                    <View style={styles.descriptionBlock}>
                                        <Text style={styles.descriptionLabel}>Descrição / Notas</Text>
                                        <Text style={styles.descriptionText}>{formatMultilineText(task.descricao)}</Text>
                                    </View>
                                )}

                                {!!task.tags && task.tags.length > 0 && (
                                    <View style={styles.row}>
                                        {task.tags.map((tag: string) => (
                                            <Text key={tag} style={styles.tag}>{tag}</Text>
                                        ))}
                                    </View>
                                )}

                                {resources.length > 0 && (
                                    <View style={{ marginTop: 6 }}>
                                        <Text style={[styles.label, { fontSize: 9, color: '#6B7280' }]}>Anexos e Links:</Text>
                                        {resources.map((res: any, idx: number) => (
                                            <Text key={idx} style={styles.link}>
                                                • {formatMultilineText(res.title || 'Recurso')}: {formatBreakableText(res.value || res.url || res)}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                <View style={styles.footer} fixed>
                    <Text render={({ pageNumber, totalPages }) => (
                        `Relatório Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')} — Página ${pageNumber} de ${totalPages}`
                    )} />
                </View>
            </Page>
        </Document>
    );
};
