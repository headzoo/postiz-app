'use client';

import {
  PlugsInterface,
  SavedPlugRow,
  usePlugs,
} from '@gitroom/frontend/components/plugs/plugs.context';
import { Button } from '@gitroom/react/form/button';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { Input } from '@gitroom/react/form/input';
import { CopilotTextarea } from '@copilotkit/react-textarea';
import clsx from 'clsx';
import { string, object } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Slider } from '@gitroom/react/form/slider';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  useChannelPlugMutations,
  useChannelPlugs,
} from '@gitroom/frontend/components/plugs/use.channel.plugs';
import { normalizeSavedPlugRows } from '@gitroom/frontend/components/plugs/plug.utils';

export function convertBackRegex(s: string) {
  const matches = s.match(/\/(.*)\/([a-z]*)/);
  const pattern = matches?.[1] || '';
  const flags = matches?.[2] || '';
  return new RegExp(pattern, flags);
}

export const TextArea: FC<{
  name: string;
  placeHolder: string;
}> = (props) => {
  const form = useFormContext();
  const { onChange, onBlur, ...all } = form.register(props.name);
  const value = form.watch(props.name);
  return (
    <>
      <textarea className="hidden" {...all}></textarea>
      <CopilotTextarea
        disableBranding={true}
        placeholder={props.placeHolder}
        value={value}
        className={clsx(
          '!min-h-40 !max-h-80 p-[24px] overflow-hidden bg-newBgColorInner outline-none rounded-[4px] border border-newBorder'
        )}
        onChange={(e) => {
          onChange({
            target: {
              name: props.name,
              value: e.target.value,
            },
          });
        }}
        autosuggestionsConfig={{
          textareaPurpose: `Assist me in writing social media posts.`,
          chatApiConfigs: {},
        }}
      />
      <div className="text-red-400 text-[12px]">
        {form?.formState?.errors?.[props.name]?.message as string}
      </div>
    </>
  );
};

export const PlugPop: FC<{
  plug: PlugsInterface;
  data?: SavedPlugRow;
  onSave: (
    func: string,
    fields: Array<{ name: string; value: string }>
  ) => Promise<void>;
}> = (props) => {
  const { plug, data, onSave } = props;
  const { closeAll } = useModals();
  const toaster = useToaster();
  const values = useMemo(() => {
    if (!data?.data) {
      return {};
    }
    return JSON.parse(data.data).reduce(
      (acc: Record<string, string>, current: { name: string; value: string }) => ({
        ...acc,
        [current.name]: current.value,
      }),
      {} as Record<string, string>
    );
  }, [data?.data]);
  const yupSchema = useMemo(() => {
    return object(
      plug.fields.reduce(
        (acc, field) => ({
          ...acc,
          [field.name]: field.validation
            ? string().matches(convertBackRegex(field.validation), {
              message: 'Invalid value',
            })
            : null,
        }),
        {}
      )
    );
  }, [plug.fields]);
  const form = useForm({
    resolver: yupResolver(yupSchema),
    values,
    mode: 'all',
  });
  const submit: SubmitHandler<Record<string, string>> = useCallback(
    async (formData) => {
      try {
        await onSave(
          plug.methodName,
          Object.keys(formData).map((key) => ({
            name: key,
            value: formData[key],
          }))
        );
        toaster.show('Plug updated', 'success');
        closeAll();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to update plug.';
        toaster.show(message, 'warning');
      }
    },
    [closeAll, onSave, plug.methodName, toaster]
  );

  const t = useT();

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="relative mx-auto">
          <div className="my-[20px]">{plug.description}</div>
          <div>
            {plug.fields.map((field) => (
              <div key={field.name}>
                {field.type === 'richtext' ? (
                  <TextArea name={field.name} placeHolder={field.placeholder} />
                ) : (
                  <Input
                    name={field.name}
                    label={field.description}
                    className="w-full mt-[8px] p-[8px] border border-newTableBorder rounded-md text-textColor"
                    placeholder={field.placeholder}
                    type={field.type}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-[20px]">
            <Button type="submit">{t('activate', 'Activate')}</Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

export const PlugItem: FC<{
  plug: PlugsInterface;
  onEdit: (data?: SavedPlugRow) => void;
  onActivate: (plugId: string, activated: boolean) => Promise<void>;
  data?: SavedPlugRow;
  disabled?: boolean;
}> = (props) => {
  const { plug, onEdit, onActivate, data, disabled } = props;
  const [activated, setActivated] = useState(!!data?.activated);
  const toaster = useToaster();
  useEffect(() => {
    setActivated(!!data?.activated);
  }, [data?.activated]);
  const changeActivated = useCallback(
    async (status: 'on' | 'off') => {
      if (!data?.id || disabled) {
        return;
      }
      try {
        await onActivate(data.id, status === 'on');
        setActivated(status === 'on');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to update plug status.';
        toaster.show(message, 'warning');
      }
    },
    [data?.id, disabled, onActivate, toaster]
  );
  const t = useT();

  return (
    <div
      onClick={() => !disabled && onEdit(data)}
      key={plug.title}
      className={clsx(
        'w-full rounded-[8px] border border-newBorder bg-newBgColorInner',
        'flex flex-col gap-[10px] p-[12px] sm:flex-row sm:items-center sm:gap-[16px]',
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer hover:bg-newTableHeader hover:border-newTableText transition-colors',
        activated && 'border-newTableText/40'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[8px] flex-wrap">
          <span className="text-[14px] font-[600] text-textColor">{plug.title}</span>
          {activated && (
            <span className="text-[10px] px-[6px] py-[1px] rounded-full border border-green-500/40 text-green-500">
              {t('active', 'Active')}
            </span>
          )}
        </div>
        <p className="text-[12px] text-newTableText line-clamp-2 mt-[2px]">
          {plug.description}
        </p>
      </div>
      <div
        className="flex items-center gap-[10px] shrink-0 self-end sm:self-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!!data && (
          <Slider
            value={activated ? 'on' : 'off'}
            onChange={changeActivated}
            fill={true}
          />
        )}
        <Button disabled={disabled} className="!py-[6px] !px-[12px] !text-[12px] whitespace-nowrap">
          {!data ? t('set_plug', 'Set') : t('edit_plug', 'Edit')}
        </Button>
      </div>
    </div>
  );
};

export const PlugGrid: FC<{
  plugs: PlugsInterface[];
  savedPlugs?: SavedPlugRow[];
  isLoading?: boolean;
  onSave: (
    func: string,
    fields: Array<{ name: string; value: string }>
  ) => Promise<void>;
  onActivate: (plugId: string, activated: boolean) => Promise<void>;
  onRevalidate?: () => void;
  disabled?: boolean;
}> = ({
  plugs,
  savedPlugs,
  isLoading,
  onSave,
  onActivate,
  onRevalidate,
  disabled,
}) => {
    const modals = useModals();
    const plugDefinitions = Array.isArray(plugs) ? plugs : [];
    const savedPlugRows = normalizeSavedPlugRows(savedPlugs);

    const addEditPlug = useCallback(
      (plugDefinition: PlugsInterface) => (saved?: SavedPlugRow) => {
        modals.openModal({
          withCloseButton: false,
          onClose() {
            onRevalidate?.();
          },
          size: '500px',
          title: `Auto Plug: ${plugDefinition.title}`,
          children: (
            <PlugPop plug={plugDefinition} data={saved} onSave={onSave} />
          ),
        });
      },
      [modals, onRevalidate, onSave]
    );

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-[24px]">
          <LoadingComponent />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-[8px]">
        {plugDefinitions.map((plugDefinition) => (
          <PlugItem
            key={plugDefinition.title + '-' + plugDefinition.methodName}
            onEdit={addEditPlug(plugDefinition)}
            onActivate={onActivate}
            plug={plugDefinition}
            disabled={disabled}
            data={savedPlugRows.find(
              (row) => row.plugFunction === plugDefinition.methodName
            )}
          />
        ))}
      </div>
    );
  };

export const Plug = () => {
  const plug = usePlugs();
  const { data, isLoading } = useChannelPlugs(plug.providerId);
  const { savePlug, activatePlug, revalidate } = useChannelPlugMutations(
    plug.providerId
  );

  return (
    <PlugGrid
      plugs={plug.plugs}
      savedPlugs={data}
      isLoading={isLoading}
      onSave={savePlug}
      onActivate={activatePlug}
      onRevalidate={revalidate}
    />
  );
};
