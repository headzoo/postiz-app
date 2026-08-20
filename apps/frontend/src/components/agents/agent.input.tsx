import React, { useMemo, useRef, useState } from 'react';
import { useCopilotContext, useCopilotReadable } from '@copilotkit/react-core';
import AutoResizingTextarea from '@gitroom/frontend/components/agents/agent.textarea';
import { useChatContext } from '@copilotkit/react-ui';
import { InputProps } from '@copilotkit/react-ui/dist/components/chat/props';
import { useAgentSkills } from '@gitroom/frontend/components/agents/use.agent.skills';
import { AgentSkillMetadata } from '@gitroom/frontend/components/context-documents/context-document.types';

const MAX_NEWLINES = 6;

const getSlashQuery = (
  text: string,
  skills: AgentSkillMetadata[]
): string | undefined => {
  if (!text.startsWith('/')) {
    return undefined;
  }

  const tokenMatch = text.match(/^\/[^\s]*/);
  if (!tokenMatch) {
    return undefined;
  }

  const firstToken = tokenMatch[0];
  const afterToken = text.slice(firstToken.length);

  if (afterToken.length > 0 && /^\s/.test(afterToken)) {
    return undefined;
  }

  const isCompletedCommand = skills.some(
    (skill) => skill.command.toLowerCase() === firstToken.toLowerCase()
  );
  if (isCompletedCommand) {
    return undefined;
  }

  return firstToken.slice(1).toLowerCase();
};

export const Input = ({
  inProgress,
  onSend,
  isVisible = false,
  onStop,
  onUpload,
  hideStopButton = false,
  onChange,
}: InputProps & { onChange: (value: string) => void }) => {
  const context = useChatContext();
  const copilotContext = useCopilotContext();
  const showPoweredBy = !copilotContext.copilotApiConfig?.publicApiKey;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const { data: skills = [], error: skillsError, isLoading: skillsLoading } =
    useAgentSkills();

  const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // If the user clicked a button or inside a button, don't focus the textarea
    if (target.closest('button')) return;

    // If the user clicked the textarea, do nothing (it's already focused)
    if (target.tagName === 'TEXTAREA') return;

    // Otherwise, focus the textarea
    textareaRef.current?.focus();
  };

  const [text, setText] = useState('');
  const slashQuery = getSlashQuery(text, skills);
  const suggestions = useMemo(() => {
    if (slashQuery === undefined) {
      return [];
    }

    return skills.filter((skill) =>
      skill.command.slice(1).toLowerCase().startsWith(slashQuery)
    );
  }, [skills, slashQuery]);
  const showSuggestions = suggestionsOpen && slashQuery !== undefined;

  const updateText = (value: string) => {
    setText(value);
    onChange(value);
  };

  const selectSuggestion = (command: string) => {
    const remainingText = text.replace(/^\/[^\s]*/, '').trimStart();
    const value = remainingText ? `${command} ${remainingText}` : `${command} `;
    updateText(value);
    setSuggestionsOpen(false);
    setActiveSuggestion(0);
    textareaRef.current?.focus();
  };

  const send = () => {
    if (inProgress) return;
    onSend(text);
    updateText('');
    setSuggestionsOpen(false);

    textareaRef.current?.focus();
  };

  const isInProgress = inProgress;
  const buttonIcon =
    isInProgress && !hideStopButton
      ? context.icons.stopIcon
      : context.icons.sendIcon;

  const canSend = useMemo(() => {
    const interruptEvent = copilotContext.langGraphInterruptAction?.event;
    const interruptInProgress =
      interruptEvent?.name === 'LangGraphInterruptEvent' &&
      !interruptEvent?.response;

    return !isInProgress && text.trim().length > 0 && !interruptInProgress;
  }, [copilotContext.langGraphInterruptAction?.event, isInProgress, text]);

  const canStop = useMemo(() => {
    return isInProgress && !hideStopButton;
  }, [isInProgress, hideStopButton]);

  const sendDisabled = !canSend && !canStop;

  return (
    <div
      className={`copilotKitInputContainer ${
        showPoweredBy ? 'poweredByContainer' : ''
      }`}
    >
      <div className="copilotKitInput relative" onClick={handleDivClick}>
        {showSuggestions && (
          <div
            id="agent-skill-suggestions"
            role="listbox"
            aria-label="Agent skills"
            className="absolute bottom-full left-0 right-0 mb-[8px] max-h-[240px] overflow-y-auto rounded-[8px] border border-newBorder bg-newBgColorInner p-[6px] shadow-lg z-10"
            data-testid="agent-skill-suggestions"
          >
            {skillsLoading && !skills.length && (
              <div className="px-[10px] py-[8px] text-[13px] text-textColor opacity-70">
                Loading skills…
              </div>
            )}
            {skillsError && (
              <div className="px-[10px] py-[8px] text-[13px] text-amber-500">
                Skills are unavailable. You can still enter a command manually.
              </div>
            )}
            {!skillsLoading && !skillsError && !suggestions.length && (
              <div className="px-[10px] py-[8px] text-[13px] text-textColor opacity-70">
                No matching skills.
              </div>
            )}
            {suggestions.map((skill, index) => {
              const optionId = `agent-skill-option-${skill.slug}`;
              return (
                <button
                  key={skill.id}
                  id={optionId}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  data-testid={`agent-skill-option-${skill.slug}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(skill.command);
                  }}
                  className={`w-full rounded-[6px] px-[10px] py-[8px] text-left text-[13px] text-textColor hover:bg-newBgColor ${
                    activeSuggestion === index ? 'bg-newBgColor' : ''
                  }`}
                >
                  <div className="font-[600]">{skill.command}</div>
                  <div className="opacity-70">{skill.name}</div>
                  {skill.isLarge && (
                    <div className="text-amber-500">Large skill file</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <AutoResizingTextarea
          ref={textareaRef}
          placeholder={context.labels.placeholder}
          autoFocus={false}
          maxRows={MAX_NEWLINES}
          value={text}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={showSuggestions ? 'agent-skill-suggestions' : undefined}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions && suggestions[activeSuggestion]
              ? `agent-skill-option-${suggestions[activeSuggestion].slug}`
              : undefined
          }
          onChange={(event) => {
            updateText(event.target.value);
            setSuggestionsOpen(true);
            setActiveSuggestion(0);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (isComposing || event.nativeEvent.isComposing) {
              return;
            }

            if (showSuggestions && suggestions.length) {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveSuggestion((current) =>
                  Math.min(current + 1, suggestions.length - 1)
                );
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveSuggestion((current) => Math.max(current - 1, 0));
                return;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                selectSuggestion(suggestions[activeSuggestion].command);
                return;
              }
            }

            if (event.key === 'Escape' && showSuggestions) {
              event.preventDefault();
              setSuggestionsOpen(false);
              return;
            }

            if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
              event.preventDefault();
              if (canSend) {
                send();
              }
            }
          }}
        />
        <div className="copilotKitInputControls">
          {onUpload && (
            <button onClick={onUpload} className="copilotKitInputControlButton">
              {context.icons.uploadIcon}
            </button>
          )}

          <div style={{ flexGrow: 1 }} />
          <button
            disabled={sendDisabled}
            onClick={isInProgress && !hideStopButton ? onStop : send}
            data-copilotkit-in-progress={inProgress}
            data-test-id={
              inProgress
                ? 'copilot-chat-request-in-progress'
                : 'copilot-chat-ready'
            }
            className="copilotKitInputControlButton"
          >
            {buttonIcon}
          </button>
        </div>
      </div>
    </div>
  );
};
